#!/usr/bin/env python3
"""One-frame-per-second vehicle detector for authorized offline demo clips."""
import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from yolox import YoloX
from tracker import CentroidLineTracker, in_roi

VEHICLE_CLASSES = {'bicycle', 'car', 'motorcycle', 'bus', 'truck'}
COCO_VEHICLE_IDS = {1: 'bicycle', 2: 'car', 3: 'motorcycle', 5: 'bus', 7: 'truck'}


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
    parser.add_argument('--confidence', type=float, default=0.35)
    parser.add_argument('--sampled-fps', type=float, default=1, help='Offline inference rate, up to 10 FPS')
    parser.add_argument('--roi', type=float, nargs=4, metavar=('X', 'Y', 'W', 'H'), help='Normalized region of interest')
    parser.add_argument('--counting-line', type=float, nargs=4, metavar=('X1', 'Y1', 'X2', 'Y2'), help='Normalized directed line for one count per track')
    parser.add_argument('--max-track-distance', type=float, default=120, help='Maximum same-class centroid movement in pixels between sampled frames')
    args = parser.parse_args()
    if not args.video.is_file() or not args.model.is_file():
        parser.error('video and model files must exist')
    if not 0 < args.confidence < 1:
        parser.error('--confidence must be between 0 and 1')
    if not 0 < args.sampled_fps <= 10:
        parser.error('--sampled-fps must be greater than 0 and at most 10')
    if args.max_track_distance <= 0:
        parser.error('--max-track-distance must be positive')
    for name, values in (('--roi', args.roi), ('--counting-line', args.counting_line)):
        if values and (min(values) < 0 or max(values) > 1):
            parser.error(f'{name} values must be normalized between 0 and 1')
    if args.roi and (args.roi[2] <= 0 or args.roi[3] <= 0 or args.roi[0] + args.roi[2] > 1 or args.roi[1] + args.roi[3] > 1):
        parser.error('--roi must fit within the normalized frame')
    if args.counting_line and args.counting_line[:2] == args.counting_line[2:]:
        parser.error('--counting-line endpoints must differ')

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        parser.error('video could not be opened')
    fps = capture.get(cv2.CAP_PROP_FPS)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = capture.get(cv2.CAP_PROP_FRAME_COUNT) / fps if fps else 0
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
    tracker = CentroidLineTracker(args.max_track_distance)
    crossing_counts = {name: 0 for name in VEHICLE_CLASSES}
    output = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', f'{effective_sampled_fps:.5f}', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '27', '-movflags', '+faststart', str(args.annotated),
    ], stdin=subprocess.PIPE)
    frames = []
    frame_index = 0
    max_per_frame = {name: 0 for name in VEHICLE_CLASSES}
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if frame_index % interval == 0:
                seconds = frame_index / fps
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                prepared, scale = letterbox(rgb)
                detections = detector.infer(prepared)
                current = {name: 0 for name in VEHICLE_CLASSES}
                entries = []
                for detection in detections:
                    x, y, box_width, box_height, score, class_id = detection
                    label = COCO_VEHICLE_IDS.get(int(class_id))
                    if label not in VEHICLE_CLASSES:
                        continue
                    x1, y1 = max(0, int(x / scale)), max(0, int(y / scale))
                    x2 = min(width, int((x + box_width) / scale))
                    y2 = min(height, int((y + box_height) / scale))
                    if x2 <= x1 or y2 <= y1:
                        continue
                    current[label] += 1
                    entries.append({'class': label, 'confidence': round(float(score), 4), 'bbox_xyxy': [x1, y1, x2, y2]})
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 30), 2)
                for name, count in current.items():
                    max_per_frame[name] = max(max_per_frame[name], count)
                track_entries = [entry for entry in entries if in_roi(entry['bbox_xyxy'], roi_pixels)]
                crossings = tracker.update(track_entries, line_pixels)
                for crossing in crossings:
                    crossing_counts[crossing['class']] += 1
                for entry in entries:
                    x1, y1 = entry['bbox_xyxy'][:2]
                    track_id = f" #{entry['track_id']}" if 'track_id' in entry else ''
                    cv2.putText(frame, f"{entry['class']}{track_id} {entry['confidence']:.2f}",
                                (x1, max(18, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 30), 2)
                if roi_pixels:
                    x, y, w, h = map(int, roi_pixels)
                    cv2.rectangle(frame, (x, y), (x + w, y + h), (255, 180, 0), 2)
                if line_pixels:
                    p1 = tuple(map(int, line_pixels[:2]))
                    p2 = tuple(map(int, line_pixels[2:]))
                    cv2.line(frame, p1, p2, (0, 140, 255), 3)
                frames.append({
                    'offset_seconds': round(seconds, 3),
                    'vehicle_counts_this_frame': current,
                    'detections': entries,
                    'line_crossings_this_frame': crossings,
                })
                cv2.putText(frame, f'DEMO SAMPLE | t={seconds:.1f}s | {effective_sampled_fps:.1f} FPS | heuristic IDs', (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                output.stdin.write(frame.tobytes())
            frame_index += 1
    finally:
        capture.release()
        output.stdin.close()
    if output.wait() != 0:
        raise SystemExit('ffmpeg H.264 annotation encoding failed')

    result = {
        'schema_version': 'webgista.traffic-analysis.v1',
        'record_kind': 'demo_video_analysis',
        'is_live_cctv': False,
        'source_reference': args.source_reference,
        'input_duration_seconds': round(duration, 3),
        'sampled_fps': round(effective_sampled_fps, 3),
        'model': {'name': 'OpenCV Zoo YOLOX-S COCO', 'version': 'object_detection_yolox_2022nov_int8', 'license': 'Apache-2.0'},
        'tracking': {
            'enabled': True,
            'algorithm': 'same-class greedy nearest-centroid association',
            'max_distance_pixels': args.max_track_distance,
            'max_missed_frames': tracker.max_missed,
            'quality': 'experimental heuristic; not validated for unique-vehicle accuracy',
            'roi_normalized': list(roi) if roi else None,
            'counting_line_normalized': list(line) if line else None,
        },
        'vehicle_count_semantics': 'Frame detections are repeated instances. Line crossing counts count each heuristic track once; track identity can split or merge and is not ground-truth unique vehicle counting.',
        'peak_vehicles_in_sampled_frame': max_per_frame,
        'line_crossing_counts_by_class': crossing_counts if line else None,
        'line_crossing_total': sum(crossing_counts.values()) if line else None,
        'condition': None,
        'condition_note': 'No traffic-condition estimate: footage road capacity, lane geometry, and calibrated survey interval are unavailable.',
        'frames': frames,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    args.json.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('input_duration_seconds', 'sampled_fps', 'peak_vehicles_in_sampled_frame', 'line_crossing_counts_by_class', 'line_crossing_total', 'tracking', 'condition')}, indent=2))


if __name__ == '__main__':
    main()
