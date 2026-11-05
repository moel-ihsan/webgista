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
    args = parser.parse_args()
    if not args.video.is_file() or not args.model.is_file():
        parser.error('video and model files must exist')
    if not 0 < args.confidence < 1:
        parser.error('--confidence must be between 0 and 1')

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
    output = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', '1', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '27', '-movflags', '+faststart', str(args.annotated),
    ], stdin=subprocess.PIPE)
    frames = []
    frame_index = 0
    max_per_frame = {name: 0 for name in VEHICLE_CLASSES}
    sampled_fps = 1
    interval = max(1, round(fps / sampled_fps))

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
                    cv2.putText(frame, f'{label} {score:.2f}', (x1, max(18, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 30), 2)
                for name, count in current.items():
                    max_per_frame[name] = max(max_per_frame[name], count)
                frames.append({'offset_seconds': round(seconds, 3), 'vehicle_counts_this_frame': current, 'detections': entries})
                cv2.putText(frame, f'DEMO SAMPLE | t={seconds:.1f}s | sampled at 1 FPS', (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
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
        'sampled_fps': sampled_fps,
        'model': {'name': 'OpenCV Zoo YOLOX-S COCO', 'version': 'object_detection_yolox_2022nov_int8', 'license': 'Apache-2.0'},
        'tracking': {'enabled': False, 'reason': 'Detector performs frame-level inference only; no object tracker is present.'},
        'vehicle_count_semantics': 'Per-frame detections; these are not unique vehicle counts.',
        'peak_vehicles_in_sampled_frame': max_per_frame,
        'condition': None,
        'condition_note': 'No calibrated condition rule was applied.',
        'frames': frames,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    args.json.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: result[key] for key in ('input_duration_seconds', 'sampled_fps', 'peak_vehicles_in_sampled_frame', 'tracking', 'condition')}, indent=2))


if __name__ == '__main__':
    main()
