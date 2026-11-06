#!/usr/bin/env python3
"""Render sampled YOLOX detections without tracker, line, or baked ROI graphics."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

import cv2


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def annotate_frame(frame, detections, seconds: float, sampled_fps: float):
    """Overlay stored detection boxes only; ROI is rendered dynamically by the app."""
    for detection in detections:
        x1, y1, x2, y2 = map(int, detection['bbox_xyxy'])
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 30), 2)
        label = f"{detection['class']}/{detection['traffic_category']} {float(detection['confidence']):.2f}"
        cv2.putText(frame, label, (x1, max(18, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 30), 2)
    cv2.putText(frame, f'EXPERIMENTAL DEMO | ROI Density | t={seconds:.1f}s | {sampled_fps:.1f} FPS',
                (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    return frame


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video', type=Path, help='Original unannotated source MP4')
    parser.add_argument('--analysis', type=Path, required=True, help='YOLOX sampled detection JSON')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    analysis = json.loads(args.analysis.read_text())
    if analysis.get('schema_version') != 'webgista.traffic-analysis.v2' or not analysis.get('frames'):
        parser.error('analysis JSON is missing sampled detection frames')
    if sha256_file(args.video) != analysis.get('source_video_sha256'):
        parser.error('source video SHA-256 does not match the analysis JSON')
    fps = float(analysis['sampled_fps'])
    width, height = int(analysis['video_dimensions']['width']), int(analysis['video_dimensions']['height'])
    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        parser.error('source video could not be opened')
    if (int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))) != (width, height):
        capture.release()
        parser.error('source video dimensions do not match the analysis JSON')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=args.output.parent, suffix='.mp4', delete=False) as tmp:
        temporary_output = Path(tmp.name)
    output = subprocess.Popen([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', f'{width}x{height}', '-r', f'{fps:.5f}', '-i', '-', '-an', '-c:v', 'libx264',
        '-preset', 'veryfast', '-crf', '24', '-movflags', '+faststart', str(temporary_output),
    ], stdin=subprocess.PIPE)
    frames = iter(analysis['frames'])
    current = next(frames, None)
    frame_index = 0
    try:
        while current is not None:
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"source video ended before sampled frame {current['frame_index']}")
            if frame_index == current['frame_index']:
                output.stdin.write(annotate_frame(frame, current['detections'], float(current['offset_seconds']), fps).tobytes())
                current = next(frames, None)
            frame_index += 1
    except Exception:
        output.stdin.close()
        output.wait()
        temporary_output.unlink(missing_ok=True)
        raise
    finally:
        capture.release()
    output.stdin.close()
    if output.wait() != 0:
        temporary_output.unlink(missing_ok=True)
        raise RuntimeError('H.264 annotation encoding failed')
    temporary_output.chmod(0o644)
    temporary_output.replace(args.output)
    print(json.dumps({'output': str(args.output), 'frames': len(analysis['frames']), 'sampled_fps': fps,
                      'source_video_sha256': analysis['source_video_sha256'], 'overlays': ['vehicle bounding boxes', 'demo label']}))


if __name__ == '__main__':
    main()
