#!/usr/bin/env python3
"""Offline YOLOX-S detection and experimental virtual-line analysis."""
import argparse
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from configuration import validate_configuration
from evaluate_ground_truth import evaluate, read_labels
from taxonomy import COCO_VEHICLES, TRAFFIC_CATEGORIES, map_coco_vehicle
from tracker import CentroidLineTracker, in_roi
from yolox import YoloX

VEHICLE_CLASSES = {'bicycle', 'car', 'motorcycle', 'bus', 'truck'}
COCO_VEHICLE_IDS = {class_id: value[0] for class_id, value in COCO_VEHICLES.items()}


def letterbox(image, size=640):
    height, width = image.shape[:2]
    scale = min(size / height, size / width)
    resized = cv2.resize(image, (int(width * scale), int(height * scale)))
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    canvas[:resized.shape[0], :resized.shape[1]] = resized
    return canvas, scale


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video', type=Path)
    parser.add_argument('--model', type=Path, required=True, help='OpenCV Zoo YOLOX ONNX model')
    parser.add_argument('--json', type=Path, required=True)
    parser.add_argument('--annotated', type=Path, required=True)
    parser.add_argument('--source-reference', required=True, help='Non-secret source/license description')
    parser.add_argument('--ground-truth', type=Path, help='Manually annotated crossing-event CSV')
    parser.add_argument('--confidence', type=float, default=0.35)
    parser.add_argument('--sampled-fps', type=float, default=1, help='Offline inference rate, up to 10 FPS')
    parser.add_argument('--roi', type=float, nargs=4, metavar=('X', 'Y', 'W', 'H'), help='Normalized region of interest')
    parser.add_argument('--counting-line', type=float, nargs=4, metavar=('X1', 'Y1', 'X2', 'Y2'), help='Normalized finite counting segment')
    parser.add_argument('--direction', choices=('both', 'negative_to_positive', 'positive_to_negative'), default='both')
    parser.add_argument('--max-track-distance', type=float, default=120)
    parser.add_argument('--max-missed-frames', type=int, default=2)
    args = parser.parse_args()
    if not args.video.is_file() or not args.model.is_file():
        parser.error('video and model files must exist')
    try:
        validate_configuration(args.confidence, args.sampled_fps, args.roi, args.counting_line,
                               args.max_track_distance, args.max_missed_frames, args.direction)
    except ValueError as error:
        parser.error(str(error))

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        parser.error('video could not be opened')
    fps = capture.get(cv2.CAP_PROP_FPS)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    source_frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = source_frame_count / fps if fps else 0
    if not fps or width <= 0 or height <= 0 or duration <= 0:
        capture.release()
        parser.error('video metadata is invalid')

    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.annotated.parent.mkdir(parents=True, exist_ok=True)
    detector = YoloX(str(args.model), confThreshold=args.confidence, objThreshold=args.confidence)
    interval = max(1, round(fps / args.sampled_fps))
    effective_sampled_fps = fps / interval
    roi = tuple(args.roi) if args.roi else None
    line = tuple(args.counting_line) if args.counting_line else None
    roi_pixels = (roi[0] * width, roi[1] * height, roi[2] * width, roi[3] * height) if roi else None
    line_pixels = (line[0] * width, line[1] * height, line[2] * width, line[3] * height) if line else None
    tracker = CentroidLineTracker(args.max_track_distance, args.max_missed_frames, args.direction)
    crossing_counts = {name: 0 for name in VEHICLE_CLASSES}
    detection_counts = Counter()
    output = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', f'{effective_sampled_fps:.5f}', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '27', '-movflags', '+faststart', str(args.annotated),
    ], stdin=subprocess.PIPE)
    frames, frame_index, processed_count = [], 0, 0
    max_per_frame = {name: 0 for name in VEHICLE_CLASSES}
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % interval == 0:
                seconds = frame_index / fps
                prepared, scale = letterbox(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                detections = detector.infer(prepared)
                current = {name: 0 for name in VEHICLE_CLASSES}
                entries = []
                for detection in detections:
                    x, y, box_width, box_height, score, class_id = detection
                    mapped = map_coco_vehicle(int(class_id))
                    if mapped is None or float(score) < args.confidence:
                        continue
                    label, traffic_category = mapped
                    x1, y1 = max(0, int(x / scale)), max(0, int(y / scale))
                    x2, y2 = min(width, int((x + box_width) / scale)), min(height, int((y + box_height) / scale))
                    if x2 <= x1 or y2 <= y1:
                        continue
                    current[label] += 1
                    detection_counts[label] += 1
                    entries.append({
                        'class': label, 'coco_class_id': int(class_id), 'traffic_category': traffic_category,
                        'confidence': round(float(score), 4), 'bbox_xyxy': [x1, y1, x2, y2],
                    })
                for name, count in current.items():
                    max_per_frame[name] = max(max_per_frame[name], count)
                track_entries = [entry for entry in entries if in_roi(entry['bbox_xyxy'], roi_pixels)]
                crossings = tracker.update(track_entries, line_pixels, frame_index, seconds)
                for crossing in crossings:
                    crossing_counts[crossing['class']] += 1
                for entry in entries:
                    x1, y1, x2, _ = entry['bbox_xyxy']
                    track_id = f" #{entry['track_id']}" if 'track_id' in entry else ''
                    cv2.rectangle(frame, tuple(entry['bbox_xyxy'][:2]), tuple(entry['bbox_xyxy'][2:]), (0, 220, 30), 2)
                    cv2.putText(frame, f"{entry['class']}/{entry['traffic_category']}{track_id} {entry['confidence']:.2f}",
                                (x1, max(18, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 30), 2)
                if roi_pixels:
                    x, y, w, h = map(int, roi_pixels)
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 180, 0), 2)
                if line_pixels:
                    cv2.line(frame, tuple(map(int, line_pixels[:2])), tuple(map(int, line_pixels[2:])), (0, 140, 255), 3)
                for event in crossings:
                    px, py = map(int, event['crossing_xy'])
                    cv2.circle(frame, (px, py), 12, (0, 0, 255), -1)
                    cv2.putText(frame, f"COUNT #{event['track_id']} {event['direction']}", (px + 12, py), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 255), 2)
                frames.append({
                    'frame_index': frame_index, 'offset_seconds': round(seconds, 3),
                    'vehicle_counts_this_frame': current, 'detections': entries,
                    'line_crossings_this_frame': crossings,
                })
                cv2.putText(frame, f'EXPERIMENTAL DEMO | t={seconds:.1f}s | {effective_sampled_fps:.1f} FPS', (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                output.stdin.write(frame.tobytes())
                processed_count += 1
            frame_index += 1
    finally:
        capture.release()
        output.stdin.close()
    if output.wait() != 0:
        raise SystemExit('ffmpeg H.264 annotation encoding failed')

    tracks = tracker.summaries()
    crossing_events = [event for frame in frames for event in frame['line_crossings_this_frame']]
    ground_truth_result = evaluate({'crossing_events': crossing_events}, read_labels(args.ground_truth)) if args.ground_truth else None
    result = {
        'schema_version': 'webgista.traffic-analysis.v2',
        'record_kind': 'demo_video_analysis', 'is_live_cctv': False,
        'source_video_identifier': args.video.stem, 'source_reference': args.source_reference,
        'input_duration_seconds': round(duration, 3), 'video_dimensions': {'width': width, 'height': height},
        'source_frame_count': source_frame_count, 'processed_frame_count': processed_count,
        'requested_sampled_fps': args.sampled_fps, 'sampled_fps': round(effective_sampled_fps, 3),
        'model': {'name': 'OpenCV Zoo YOLOX-S COCO', 'version': 'object_detection_yolox_2022nov_int8', 'license': 'Apache-2.0'},
        'tracking': {
            'enabled': True, 'algorithm': 'greedy same-class centroid association with linear velocity prediction',
            'max_distance_pixels': args.max_track_distance, 'max_missed_frames': args.max_missed_frames,
            'quality': 'experimental; not ground-truth validated',
            'roi_normalized': list(roi) if roi else None, 'counting_line_normalized': list(line) if line else None,
        },
        'processing_config': {
            'minimum_detection_confidence': args.confidence, 'roi_normalized': list(roi) if roi else None,
            'counting_line_normalized': list(line) if line else None, 'allowed_direction': args.direction,
            'tracking_algorithm': 'greedy same-class centroid association with linear velocity prediction',
            'max_track_distance_pixels': args.max_track_distance, 'max_missed_frames': args.max_missed_frames,
        },
        'detection_instances_by_class': {name: detection_counts[name] for name in sorted(VEHICLE_CLASSES)},
        'detection_instances_by_traffic_category': {
            category: sum(detection_counts[name] for class_id, (name, mapped_category) in COCO_VEHICLES.items() if mapped_category == category)
            for category in TRAFFIC_CATEGORIES
        },
        'tracked_objects_count': len(tracks), 'tracked_objects': tracks,
        'tracking_quality': {
            'status': 'not_ground_truth_validated',
            'single_detection_track_count': sum(track['observations'] == 1 for track in tracks),
            'mean_sampled_observations_per_track': round(sum(track['observations'] for track in tracks) / len(tracks), 3) if tracks else 0,
            'note': 'These diagnostics describe tracker output only; they are not accuracy metrics.',
        },
        'crossing_event_count': len(crossing_events), 'crossing_events': crossing_events,
        'crossing_counts_by_class': crossing_counts if line else None,
        'ground_truth_evaluation': ground_truth_result,
        'ground_truth_status': 'evaluated' if ground_truth_result and ground_truth_result['ground_truth_available'] else 'not_available',
        'peak_vehicles_in_sampled_frame': max_per_frame,
        'vehicle_count_semantics': 'Detection instances repeat across frames. Track IDs and line-crossing events are experimental and unvalidated; only manually ground-truth-matched events may be described as validated counts.',
        'condition': None,
        'condition_note': 'No valid estimate: the demo clip is under 30 seconds and lacks ground-truth-validated counts and road-capacity configuration.',
        'frames': frames, 'created_at': datetime.now(timezone.utc).isoformat(),
    }
    args.json.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('input_duration_seconds', 'processed_frame_count', 'detection_instances_by_class', 'tracked_objects_count', 'crossing_event_count', 'tracking_quality', 'condition')}, indent=2))


if __name__ == '__main__':
    main()
