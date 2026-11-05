import unittest
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from analyze_video import COCO_VEHICLE_IDS, VEHICLE_CLASSES, letterbox
from tracker import CentroidLineTracker, in_roi


class PipelineTest(unittest.TestCase):
    def test_letterbox_produces_detector_size_and_scale(self):
        image = np.zeros((360, 640, 3), dtype=np.uint8)
        result, scale = letterbox(image)
        self.assertEqual(result.shape, (640, 640, 3))
        self.assertAlmostEqual(scale, 1.0)

    def test_person_is_not_classified_as_a_vehicle(self):
        self.assertNotIn('person', VEHICLE_CLASSES)
        self.assertNotIn('person', COCO_VEHICLE_IDS.values())
        self.assertNotIn(0, COCO_VEHICLE_IDS)
        self.assertEqual(VEHICLE_CLASSES, {'bicycle', 'car', 'motorcycle', 'bus', 'truck'})

    def test_same_vehicle_is_counted_once_when_crossing_virtual_line(self):
        tracker = CentroidLineTracker(max_distance=40)
        line = (50, 0, 50, 100)
        left = {'class': 'car', 'bbox_xyxy': [35, 20, 45, 30]}
        across = {'class': 'car', 'bbox_xyxy': [55, 20, 65, 30]}
        further = {'class': 'car', 'bbox_xyxy': [65, 20, 75, 30]}
        back = {'class': 'car', 'bbox_xyxy': [35, 20, 45, 30]}
        self.assertEqual(tracker.update([left], line), [])
        self.assertEqual(tracker.update([across], line), [{'track_id': 1, 'class': 'car'}])
        self.assertEqual(tracker.update([further], line), [])
        self.assertEqual(tracker.update([back], line), [])
        self.assertEqual([row['track_id'] for row in (left, across, further, back)], [1, 1, 1, 1])

    def test_roi_uses_detection_center(self):
        self.assertTrue(in_roi([40, 40, 60, 60], (25, 25, 50, 50)))
        self.assertFalse(in_roi([0, 0, 10, 10], (25, 25, 50, 50)))

    def test_crossing_sampled_exactly_on_line_is_not_lost(self):
        tracker = CentroidLineTracker(max_distance=40)
        line = (50, 0, 50, 100)
        self.assertEqual(tracker.update([{'class': 'car', 'bbox_xyxy': [35, 20, 45, 30]}], line), [])
        self.assertEqual(tracker.update([{'class': 'car', 'bbox_xyxy': [45, 20, 55, 30]}], line), [])
        self.assertEqual(tracker.update([{'class': 'car', 'bbox_xyxy': [55, 20, 65, 30]}], line), [{'track_id': 1, 'class': 'car'}])


if __name__ == '__main__':
    unittest.main()
