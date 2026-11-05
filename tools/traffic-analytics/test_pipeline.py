import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from analyze_video import letterbox
from configuration import validate_configuration
from evaluate_ground_truth import evaluate, read_labels
from taxonomy import map_coco_vehicle
from tracker import CentroidLineTracker, in_roi


class PipelineTest(unittest.TestCase):
    def test_letterbox_produces_detector_size_and_scale(self):
        image = np.zeros((360, 640, 3), dtype=np.uint8)
        result, scale = letterbox(image)
        self.assertEqual(result.shape, (640, 640, 3))
        self.assertAlmostEqual(scale, 1.0)

    def test_vehicle_mapping_is_explicit_and_excludes_person_unknown(self):
        self.assertEqual(map_coco_vehicle(2), ('car', 'LV'))
        self.assertEqual(map_coco_vehicle(3), ('motorcycle', 'MC'))
        self.assertEqual(map_coco_vehicle(5), ('bus', 'HV'))
        self.assertEqual(map_coco_vehicle(7), ('truck', 'HV'))
        self.assertEqual(map_coco_vehicle(1), ('bicycle', 'bicycle'))
        self.assertIsNone(map_coco_vehicle(0))
        self.assertIsNone(map_coco_vehicle(80))

    def test_velocity_prediction_keeps_identity_after_one_missed_frame(self):
        tracker = CentroidLineTracker(max_distance=15, max_missed=2)
        line = (50, 0, 50, 100)
        first = {'class': 'car', 'traffic_category': 'LV', 'bbox_xyxy': [10, 20, 20, 30]}
        second = {'class': 'car', 'traffic_category': 'LV', 'bbox_xyxy': [20, 20, 30, 30]}
        after_gap = {'class': 'car', 'traffic_category': 'LV', 'bbox_xyxy': [50, 20, 60, 30]}
        tracker.update([first], line, 0, 0)
        tracker.update([second], line, 1, 0.2)
        tracker.update([], line, 2, 0.4)
        events = tracker.update([after_gap], line, 3, 0.6)
        self.assertEqual(after_gap['track_id'], first['track_id'])
        self.assertEqual(events[0]['direction'], 'positive_to_negative')
        self.assertEqual(events[0]['traffic_category'], 'LV')

    def test_crossing_event_is_once_per_track_and_has_time_and_direction(self):
        tracker = CentroidLineTracker(max_distance=40)
        line = (50, 0, 50, 100)
        points = [[35, 20, 45, 30], [55, 20, 65, 30], [65, 20, 75, 30], [35, 20, 45, 30]]
        events = []
        for frame, box in enumerate(points):
            events.extend(tracker.update([{'class': 'car', 'bbox_xyxy': box}], line, frame, frame / 5))
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['direction'], 'positive_to_negative')
        self.assertEqual(events[0]['timestamp_seconds'], 0.2)
        self.assertEqual(tracker.summaries()[0]['observations'], 4)

    def test_only_finite_counting_segment_is_counted(self):
        tracker = CentroidLineTracker(max_distance=60)
        line = (50, 20, 50, 80)
        tracker.update([{'class': 'car', 'bbox_xyxy': [35, -45, 45, -35]}], line)
        self.assertEqual(tracker.update([{'class': 'car', 'bbox_xyxy': [55, -45, 65, -35]}], line), [])

    def test_allowed_direction_rejects_reverse_crossing(self):
        tracker = CentroidLineTracker(max_distance=40, allowed_direction='positive_to_negative')
        line = (50, 0, 50, 100)
        tracker.update([{'class': 'car', 'bbox_xyxy': [55, 20, 65, 30]}], line)
        events = tracker.update([{'class': 'car', 'bbox_xyxy': [35, 20, 45, 30]}], line)
        self.assertEqual(events, [])

    def test_crossing_sampled_on_line_is_detected_when_it_leaves(self):
        tracker = CentroidLineTracker(max_distance=40)
        line = (50, 0, 50, 100)
        tracker.update([{'class': 'car', 'bbox_xyxy': [35, 20, 45, 30]}], line)
        tracker.update([{'class': 'car', 'bbox_xyxy': [45, 20, 55, 30]}], line)
        events = tracker.update([{'class': 'car', 'bbox_xyxy': [55, 20, 65, 30]}], line)
        self.assertEqual(len(events), 1)

    def test_roi_uses_detection_center(self):
        self.assertTrue(in_roi([40, 40, 60, 60], (25, 25, 50, 50)))
        self.assertFalse(in_roi([0, 0, 10, 10], (25, 25, 50, 50)))

    def test_configuration_rejects_invalid_roi_line_direction_and_confidence(self):
        valid = (0.4, 5, [0, 0, 1, 1], [0.5, 0, 0.5, 1], 120, 2, 'both')
        validate_configuration(*valid)
        for values in (
            (1, *valid[1:]),
            (valid[0], valid[1], [-0.1, 0, 1, 1], *valid[3:]),
            (valid[0], valid[1], *valid[2:3], [0.5, 0, 0.5, 0], *valid[4:]),
            (*valid[:-1], 'sideways'),
            (valid[0], valid[1], [float('nan'), 0, 1, 1], *valid[3:]),
            (valid[0], valid[1], valid[2], valid[3], float('inf'), *valid[5:]),
        ):
            with self.assertRaises(ValueError):
                validate_configuration(*values)

    def test_ground_truth_empty_means_no_metrics(self):
        self.assertEqual(evaluate({'crossing_events': []}, []), {
            'ground_truth_available': False, 'metrics': None,
            'note': 'No manual ground-truth events were supplied.',
        })

    def test_ground_truth_metrics_are_one_to_one_by_category_direction_and_time(self):
        analysis = {'crossing_events': [
            {'class': 'car', 'traffic_category': 'LV', 'direction': 'positive_to_negative', 'timestamp_seconds': 2.2},
            {'class': 'bus', 'traffic_category': 'HV', 'direction': 'positive_to_negative', 'timestamp_seconds': 5},
        ]}
        labels = [
            {'event_id': 'g1', 'vehicle_category': 'LV', 'direction': 'positive_to_negative', 'timestamp_seconds': 2.0},
            {'event_id': 'g2', 'vehicle_category': 'LV', 'direction': 'positive_to_negative', 'timestamp_seconds': 2.1},
        ]
        metrics = evaluate(analysis, labels, 0.5)['metrics']
        self.assertEqual((metrics['true_positive'], metrics['false_positive'], metrics['false_negative']), (1, 1, 1))
        self.assertEqual(metrics['absolute_count_error'], 0)
        self.assertEqual(metrics['by_vehicle_category']['HV']['false_positive'], 1)

    def test_ground_truth_csv_rejects_duplicate_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'labels.csv'
            path.write_text('event_id,vehicle_category,direction,timestamp_seconds,frame_index\nx,LV,positive_to_negative,1,10\nx,LV,positive_to_negative,2,20\n')
            with self.assertRaises(ValueError):
                read_labels(path)

    def test_committed_demo_outputs_have_reproducible_schema_and_no_condition(self):
        repository = Path(__file__).resolve().parents[2]
        for sample in ('traffic_sample_01', 'traffic_sample_02'):
            result = json.loads((repository / 'apps/web/src/data/traffic-demo' / f'{sample}.analysis.json').read_text())
            self.assertEqual(result['schema_version'], 'webgista.traffic-analysis.v2')
            self.assertFalse(result['is_live_cctv'])
            self.assertIsNone(result['condition'])
            self.assertEqual(result['processed_frame_count'], len(result['frames']))
            self.assertEqual(result['crossing_event_count'], len(result['crossing_events']))
            self.assertEqual(result['tracking_quality']['status'], 'not_ground_truth_validated')
            self.assertIsNone(result['ground_truth_evaluation'])
            self.assertEqual(
                sum(result['detection_instances_by_class'].values()),
                sum(len(frame['detections']) for frame in result['frames']),
            )
            for frame in result['frames']:
                for detection in frame['detections']:
                    self.assertIn(detection['traffic_category'], ('LV', 'HV', 'MC', 'bicycle'))


if __name__ == '__main__':
    unittest.main()
