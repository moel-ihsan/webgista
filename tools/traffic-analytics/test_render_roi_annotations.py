import unittest

import numpy as np

from render_roi_annotations import annotate_frame


class RoiAnnotationTests(unittest.TestCase):
    def test_draws_detection_boxes_without_old_roi_or_counting_line(self):
        frame = np.zeros((360, 640, 3), dtype=np.uint8)
        annotated = annotate_frame(frame, [{
            'class': 'car', 'traffic_category': 'LV', 'confidence': .9,
            'bbox_xyxy': [20, 40, 80, 100], 'track_id': 123,
        }], 8, 5)

        self.assertTrue(np.array_equal(annotated[40, 50], np.array([0, 220, 30], dtype=np.uint8)))
        self.assertTrue(np.array_equal(annotated[100, 50], np.array([0, 220, 30], dtype=np.uint8)))
        self.assertTrue(np.array_equal(annotated[180, 400], np.zeros(3, dtype=np.uint8)))
        self.assertTrue(np.array_equal(annotated[300, 300], np.zeros(3, dtype=np.uint8)))


if __name__ == '__main__':
    unittest.main()
