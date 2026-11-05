import unittest
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from analyze_video import VEHICLE_CLASSES, letterbox


class PipelineTest(unittest.TestCase):
    def test_letterbox_produces_detector_size_and_scale(self):
        image = np.zeros((360, 640, 3), dtype=np.uint8)
        result, scale = letterbox(image)
        self.assertEqual(result.shape, (640, 640, 3))
        self.assertAlmostEqual(scale, 1.0)

    def test_person_is_not_classified_as_a_vehicle(self):
        self.assertNotIn('person', VEHICLE_CLASSES)
        self.assertEqual(VEHICLE_CLASSES, {'bicycle', 'car', 'motorcycle', 'bus', 'truck'})


if __name__ == '__main__':
    unittest.main()
