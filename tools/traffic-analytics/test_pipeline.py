import json
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from analyze_video import letterbox
from configuration import validate_configuration
from evaluate_ground_truth import evaluate, evaluate_review_package, read_labels
from taxonomy import map_coco_vehicle
from tracker import CentroidLineTracker, in_roi
from annotation_review.serve import parse_byte_range


class PipelineTest(unittest.TestCase):
    @staticmethod
    def complete_review_package(events=None):
        return {
            'schema_version': 'webgista.traffic-ground-truth.v1',
            'video': {'id': 'sample-01', 'source_sha256': 'sha'},
            'review_progress': {'full_clip_reviewed': True, 'attested': True, 'reviewed_seconds': list(range(23))},
            'reviewer': 'reviewer-1', 'events': events or [],
        }

    def test_letterbox_produces_detector_size_and_scale(self):
        image = np.zeros((360, 640, 3), dtype=np.uint8)
        result, scale = letterbox(image)
        self.assertEqual(result.shape, (640, 640, 3))
        self.assertAlmostEqual(scale, 1.0)

    def test_local_video_server_parses_bounded_and_suffix_ranges(self):
        self.assertEqual(parse_byte_range(None, 100), None)
        self.assertEqual(parse_byte_range('bytes=0-0', 100), (0, 0))
        self.assertEqual(parse_byte_range('bytes=-10', 100), (90, 99))
        self.assertEqual(parse_byte_range('bytes=90-', 100), (90, 99))
        with self.assertRaises(ValueError):
            parse_byte_range('bytes=100-110', 100)
        with self.assertRaises(ValueError):
            parse_byte_range('bytes=0-1,4-5', 100)

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

    def test_expired_track_cannot_be_reacquired_after_missed_frame_limit(self):
        tracker = CentroidLineTracker(max_distance=100, max_missed=1)
        first = {'class': 'car', 'bbox_xyxy': [10, 10, 20, 20]}
        tracker.update([first], frame_index=0)
        tracker.update([], frame_index=1)
        tracker.update([], frame_index=2)
        later = {'class': 'car', 'bbox_xyxy': [15, 10, 25, 20]}
        tracker.update([later], frame_index=3)
        self.assertEqual(first['track_id'], 1)
        self.assertEqual(later['track_id'], 2)

    def test_track_summary_exposes_gap_and_confidence_diagnostics(self):
        tracker = CentroidLineTracker(max_distance=20, max_missed=2)
        for frame, x in ((0, 10), (1, 20)):
            tracker.update([{'class': 'car', 'confidence': 0.8, 'bbox_xyxy': [x, 10, x + 10, 20]}], frame_index=frame, timestamp_seconds=frame / 5)
        tracker.update([], frame_index=2, timestamp_seconds=2 / 5)
        tracker.update([{'class': 'car', 'confidence': 0.8, 'bbox_xyxy': [40, 10, 50, 20]}], frame_index=3, timestamp_seconds=3 / 5)
        summary = tracker.summaries()[0]
        self.assertEqual(summary['observations'], 3)
        self.assertEqual(summary['gap_reacquisitions'], 1)
        self.assertEqual(summary['max_intervening_missed_samples'], 1)
        self.assertEqual(summary['mean_detection_confidence'], 0.8)
        self.assertEqual(summary['last_prediction_error_pixels'], 5)

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
        self.assertFalse(evaluate({'crossing_events': []}, [])['ground_truth_available'])

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

    def test_review_package_requires_matching_video_hash_full_clip_and_resolved_events(self):
        analysis = {'source_video_identifier': 'sample-01', 'source_video_sha256': 'sha', 'input_duration_seconds': 23, 'source_fps': 24, 'source_frame_count': 552, 'crossing_events': []}
        base = {
            'schema_version': 'webgista.traffic-ground-truth.v1',
            'video': {'id': 'sample-01', 'source_sha256': 'sha'},
            'review_progress': {'full_clip_reviewed': False, 'attested': False, 'reviewed_seconds': []},
            'reviewer': 'reviewer-1', 'events': [],
        }
        self.assertFalse(evaluate_review_package(analysis, base)['ground_truth_available'])
        full = self.complete_review_package()
        self.assertTrue(evaluate_review_package(analysis, full)['ground_truth_available'])
        uncertain = {**full, 'events': [{'event_id': 'GT-1', 'review_status': 'uncertain'}]}
        self.assertIn('uncertain', evaluate_review_package(analysis, uncertain)['note'])
        wrong_source = {**full, 'video': {'id': 'sample-01', 'source_sha256': 'wrong'}}
        self.assertIn('SHA-256', evaluate_review_package(analysis, wrong_source)['note'])

    def test_fully_reviewed_empty_clip_counts_predictions_as_false_positives(self):
        analysis = {
            'source_video_identifier': 'sample-01', 'source_video_sha256': 'sha',
            'input_duration_seconds': 23, 'source_fps': 24, 'source_frame_count': 552,
            'crossing_events': [{'class': 'car', 'traffic_category': 'LV', 'direction': 'positive_to_negative', 'timestamp_seconds': 2}],
        }
        package = self.complete_review_package()
        metrics = evaluate_review_package(analysis, package)['metrics']
        self.assertEqual((metrics['true_positive'], metrics['false_positive'], metrics['false_negative']), (0, 1, 0))
        self.assertEqual(metrics['by_direction']['positive_to_negative']['false_positive'], 1)

    def test_review_package_rejects_missing_coverage_bad_frame_or_unidentified_reviewer(self):
        analysis = {'source_video_identifier': 'sample-01', 'source_video_sha256': 'sha', 'input_duration_seconds': 23, 'source_fps': 24, 'source_frame_count': 552, 'crossing_events': []}
        package = self.complete_review_package()
        package['review_progress']['reviewed_seconds'].pop()
        self.assertIn('coverage is incomplete', evaluate_review_package(analysis, package)['note'])
        package = self.complete_review_package([{
            'event_id': 'GT-001', 'review_status': 'confirmed', 'vehicle_class': 'car',
            'direction': 'positive_to_negative', 'timestamp_seconds': 1, 'frame_index': -1,
            'reviewer': 'reviewer-1', 'annotation_provenance': 'human_video_review',
        }])
        self.assertIn('invalid', evaluate_review_package(analysis, package)['note'])
        package = self.complete_review_package()
        package['reviewer'] = ''
        self.assertIn('reviewer ID', evaluate_review_package(analysis, package)['note'])

    def test_completed_review_reports_human_diagnostics_separately_from_event_metrics(self):
        analysis = {
            'source_video_identifier': 'sample-01', 'source_video_sha256': 'sha',
            'input_duration_seconds': 23, 'source_fps': 24, 'source_frame_count': 552,
            'crossing_events': [{'class': 'car', 'traffic_category': 'LV', 'direction': 'positive_to_negative', 'timestamp_seconds': 2}],
        }
        event = {
            'event_id': 'GT-001', 'review_status': 'confirmed', 'vehicle_class': 'car',
            'direction': 'positive_to_negative', 'timestamp_seconds': 2, 'frame_index': 48,
            'reviewer': 'reviewer-1', 'annotation_provenance': 'human_video_review',
            'diagnostic_category': 'fragmented_track',
        }
        result = evaluate_review_package(analysis, self.complete_review_package([event]))
        self.assertEqual(result['metrics']['true_positive'], 1)
        self.assertEqual(result['review_diagnostics'], {'fragmented_track': 1})

    def test_committed_demo_outputs_have_reproducible_schema_and_no_condition(self):
        repository = Path(__file__).resolve().parents[2]
        for sample in ('traffic_sample_01', 'traffic_sample_02'):
            result = json.loads((repository / 'apps/web/src/data/traffic-demo' / f'{sample}.analysis.json').read_text())
            source_path = repository / 'apps/web/public/traffic-demo' / f'{sample}.mp4'
            self.assertEqual(result['schema_version'], 'webgista.traffic-analysis.v2')
            self.assertFalse(result['is_live_cctv'])
            self.assertEqual(result['source_video_sha256'], hashlib.sha256(source_path.read_bytes()).hexdigest())
            self.assertEqual(len(result['model']['sha256']), 64)
            self.assertGreater(result['source_fps'], 0)
            self.assertEqual(result['sample_frame_interval'], 5)
            self.assertIsNone(result['condition'])
            self.assertEqual(result['processed_frame_count'], len(result['frames']))
            self.assertEqual(result['crossing_event_count'], len(result['crossing_events']))
            self.assertEqual(result['tracking_quality']['single_detection_track_count'], sum(track['observations'] == 1 for track in result['tracked_objects']))
            self.assertTrue(all(0 <= track['mean_detection_confidence'] <= 1 for track in result['tracked_objects']))
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
