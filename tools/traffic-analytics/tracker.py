"""Lightweight same-class centroid association and once-per-track line crossing."""
from math import hypot


class CentroidLineTracker:
    def __init__(self, max_distance=120, max_missed=2):
        self.max_distance = max_distance
        self.max_missed = max_missed
        self.tracks = {}
        self.next_id = 1

    @staticmethod
    def center(box):
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)

    @staticmethod
    def side(point, line):
        x1, y1, x2, y2 = line
        return (x2 - x1) * (point[1] - y1) - (y2 - y1) * (point[0] - x1)

    @staticmethod
    def crossed(previous, current):
        return previous != 0 and current != 0 and (previous < 0) != (current < 0)

    def update(self, detections, line=None):
        for track in self.tracks.values():
            track['missed'] += 1

        candidates = []
        centers = [self.center(row['bbox_xyxy']) for row in detections]
        for detection_index, detection in enumerate(detections):
            for track_id, track in self.tracks.items():
                if detection['class'] != track['class']:
                    continue
                distance = hypot(centers[detection_index][0] - track['center'][0], centers[detection_index][1] - track['center'][1])
                if distance <= self.max_distance:
                    candidates.append((distance, detection_index, track_id))

        used_detections, used_tracks = set(), set()
        assigned = {}
        for _, detection_index, track_id in sorted(candidates):
            if detection_index in used_detections or track_id in used_tracks:
                continue
            used_detections.add(detection_index)
            used_tracks.add(track_id)
            assigned[detection_index] = track_id

        events = []
        for index, detection in enumerate(detections):
            center = centers[index]
            track_id = assigned.get(index)
            if track_id is None:
                track_id = self.next_id
                self.next_id += 1
                previous_side = 0
                counted = False
            else:
                track = self.tracks[track_id]
                previous_side = track['side']
                counted = track['counted']

            current_side = self.side(center, line) if line else 0
            if line and not counted and self.crossed(previous_side, current_side):
                events.append({'track_id': track_id, 'class': detection['class']})
                counted = True
            remembered_side = current_side if current_side else previous_side
            detection['track_id'] = track_id
            self.tracks[track_id] = {
                'class': detection['class'], 'center': center, 'missed': 0,
                'side': remembered_side, 'counted': counted,
            }

        self.tracks = {key: value for key, value in self.tracks.items() if value['missed'] <= self.max_missed}
        return events


def in_roi(box, roi):
    if roi is None:
        return True
    x, y, width, height = roi
    center_x, center_y = CentroidLineTracker.center(box)
    return x <= center_x <= x + width and y <= center_y <= y + height
