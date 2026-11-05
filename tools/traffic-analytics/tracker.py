"""Lightweight velocity-predicted centroid tracking and finite-line counting."""
from math import hypot, isfinite


class CentroidLineTracker:
    def __init__(self, max_distance=120, max_missed=2, allowed_direction='both'):
        if not isfinite(max_distance) or max_distance <= 0 or max_missed < 0:
            raise ValueError('tracking limits must be positive')
        if allowed_direction not in ('both', 'negative_to_positive', 'positive_to_negative'):
            raise ValueError('unsupported crossing direction')
        self.max_distance = max_distance
        self.max_missed = max_missed
        self.allowed_direction = allowed_direction
        self.tracks = {}
        self.finished_tracks = {}
        self.next_id = 1

    @staticmethod
    def center(box):
        return ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)

    @staticmethod
    def side(point, line):
        x1, y1, x2, y2 = line
        return (x2 - x1) * (point[1] - y1) - (y2 - y1) * (point[0] - x1)

    @staticmethod
    def _intersection_on_line(previous, current, line):
        """Return the finite segment intersection; an infinite-line crossing is insufficient."""
        ax, ay = previous
        bx, by = current
        cx, cy, dx, dy = line
        rx, ry, sx, sy = bx - ax, by - ay, dx - cx, dy - cy
        denominator = rx * sy - ry * sx
        if denominator == 0:
            return None
        qpx, qpy = cx - ax, cy - ay
        t = (qpx * sy - qpy * sx) / denominator
        u = (qpx * ry - qpy * rx) / denominator
        if 0 <= t <= 1 and 0 <= u <= 1:
            return (ax + t * rx, ay + t * ry)
        return None

    def _new_track(self, detection, center, side, frame_index, timestamp_seconds):
        track_id = self.next_id
        self.next_id += 1
        self.tracks[track_id] = {
            'class': detection['class'], 'traffic_category': detection.get('traffic_category'),
            'center': center, 'velocity': (0, 0),
            'missed': 0, 'observations': 0, 'first_frame': frame_index,
            'last_frame': frame_index, 'first_timestamp_seconds': timestamp_seconds,
            'last_timestamp_seconds': timestamp_seconds, 'side': side,
            'last_nonzero_center': center if side else None, 'counted': False,
        }
        return track_id

    def update(self, detections, line=None, frame_index=None, timestamp_seconds=None):
        for track in self.tracks.values():
            track['missed'] += 1

        centers = [self.center(row['bbox_xyxy']) for row in detections]
        candidates = []
        for detection_index, detection in enumerate(detections):
            for track_id, track in self.tracks.items():
                if detection['class'] != track['class']:
                    continue
                missed_steps = track['missed'] + 1
                predicted = (
                    track['center'][0] + track['velocity'][0] * missed_steps,
                    track['center'][1] + track['velocity'][1] * missed_steps,
                )
                distance = hypot(centers[detection_index][0] - predicted[0], centers[detection_index][1] - predicted[1])
                if distance <= self.max_distance * missed_steps:
                    candidates.append((distance / missed_steps, detection_index, track_id))

        used_detections, used_tracks, assigned = set(), set(), {}
        for _, detection_index, track_id in sorted(candidates):
            if detection_index not in used_detections and track_id not in used_tracks:
                used_detections.add(detection_index)
                used_tracks.add(track_id)
                assigned[detection_index] = track_id

        events = []
        for index, detection in enumerate(detections):
            center = centers[index]
            track_id = assigned.get(index)
            current_side = self.side(center, line) if line else 0
            if track_id is None:
                track_id = self._new_track(detection, center, current_side, frame_index, timestamp_seconds)
            track = self.tracks[track_id]
            if track['observations']:
                steps = track['missed'] + 1
                track['velocity'] = (
                    (center[0] - track['center'][0]) / steps,
                    (center[1] - track['center'][1]) / steps,
                )
            previous_side = track['side']
            crossing_point = None
            if line and not track['counted'] and previous_side and current_side and ((previous_side < 0) != (current_side < 0)):
                previous = track['last_nonzero_center']
                crossing_point = self._intersection_on_line(previous, center, line) if previous else None
                direction = 'positive_to_negative' if previous_side > 0 else 'negative_to_positive'
                if crossing_point and self.allowed_direction in ('both', direction):
                    event = {
                        'track_id': track_id, 'class': detection['class'],
                        'traffic_category': detection.get('traffic_category'),
                        'direction': direction, 'frame_index': frame_index,
                        'timestamp_seconds': round(timestamp_seconds, 3) if timestamp_seconds is not None else None,
                        'crossing_xy': [round(crossing_point[0], 2), round(crossing_point[1], 2)],
                    }
                    events.append(event)
                    track['counted'] = True

            track.update({
                'center': center, 'missed': 0, 'observations': track['observations'] + 1,
                'last_frame': frame_index, 'last_timestamp_seconds': timestamp_seconds,
                'side': current_side if current_side else previous_side,
            })
            if current_side:
                track['last_nonzero_center'] = center
            detection['track_id'] = track_id

        expired = [key for key, track in self.tracks.items() if track['missed'] > self.max_missed]
        for track_id in expired:
            track = self.tracks.pop(track_id)
            self.finished_tracks[track_id] = track
        return events

    def summaries(self):
        return [
            {
                'track_id': track_id, 'class': track['class'],
                'traffic_category': track['traffic_category'],
                'observations': track['observations'], 'first_frame': track['first_frame'],
                'last_frame': track['last_frame'],
                'first_timestamp_seconds': track['first_timestamp_seconds'],
                'last_timestamp_seconds': track['last_timestamp_seconds'],
                'crossed_counting_line': track['counted'],
            }
            for track_id, track in sorted({**self.finished_tracks, **self.tracks}.items())
        ]


def in_roi(box, roi):
    if roi is None:
        return True
    x, y, width, height = roi
    center_x, center_y = CentroidLineTracker.center(box)
    return x <= center_x <= x + width and y <= center_y <= y + height
