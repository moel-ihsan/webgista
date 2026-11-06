#!/usr/bin/env python3
"""Aggregate previously sampled YOLOX detections into 10-second ROI presence windows."""
import argparse
import json
from pathlib import Path

from roi_density import aggregate_windows, bottom_center_in_roi, roi_image_coverage, validate_config


def analyze_detection_document(document, config):
    polygon = validate_config(config)
    dimensions = config['video_dimensions']
    if config['source_video_identifier'] != document.get('source_video_identifier'):
        raise ValueError('ROI configuration source video does not match the analyzed source')
    if 'camera_id' in config:
        if not isinstance(config.get('camera_id'), str) or not config['camera_id'].strip():
            raise ValueError('camera ID is required for a camera-bound ROI configuration')
        if not isinstance(config.get('configuration_version'), int) or config['configuration_version'] < 1:
            raise ValueError('a valid saved configuration version is required')
    if document.get('video_dimensions') != dimensions:
        raise ValueError('configuration video dimensions do not match the analyzed source')
    if document.get('record_kind') != 'demo_video_analysis' and not document.get('source_video_sha256'):
        raise ValueError('source video provenance is required')
    samples = []
    for frame in document.get('frames', []):
        detections = frame.get('detections')
        timestamp = frame.get('offset_seconds')
        if not isinstance(detections, list) or not isinstance(timestamp, (int, float)):
            continue
        valid_detections = [
            detection for detection in detections
            if detection.get('class') in config['included_classes']
            and isinstance(detection.get('confidence'), (int, float))
            and detection['confidence'] >= config['minimum_detection_confidence']
            and len(detection.get('bbox_xyxy', [])) == 4
            and all(isinstance(value, (int, float)) for value in detection['bbox_xyxy'])
        ]
        normalized_detections = [
            {**detection, 'bbox_xyxy': [
                detection['bbox_xyxy'][0] / dimensions['width'], detection['bbox_xyxy'][1] / dimensions['height'],
                detection['bbox_xyxy'][2] / dimensions['width'], detection['bbox_xyxy'][3] / dimensions['height'],
            ]}
            for detection in valid_detections
        ]
        roi_detections = [detection for detection in valid_detections if bottom_center_in_roi(
            {**detection, 'bbox_xyxy': [
                detection['bbox_xyxy'][0] / dimensions['width'], detection['bbox_xyxy'][1] / dimensions['height'],
                detection['bbox_xyxy'][2] / dimensions['width'], detection['bbox_xyxy'][3] / dimensions['height'],
            ]}, polygon,
        )]
        samples.append({
            'timestamp_seconds': float(timestamp), 'detections': normalized_detections,
            'roi_coverage': roi_image_coverage(
                dimensions['width'], dimensions['height'], polygon, roi_detections,
                config['included_classes'], config['minimum_detection_confidence'],
            ),
        })
    return aggregate_windows(
        samples, float(document['input_duration_seconds']), config,
        {
            'source_video_identifier': document['source_video_identifier'],
            'source_video_sha256': document['source_video_sha256'],
            'is_live_cctv': bool(document.get('is_live_cctv', False)),
            'record_kind': document.get('record_kind', 'authorized_video_analysis'),
            'model': document.get('model'), 'detections_reused_from': document.get('schema_version'),
            'sampled_fps': document.get('sampled_fps'),
            **({'camera_id': config['camera_id']} if 'camera_id' in config else {}),
        },
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--analysis-json', type=Path, required=True, help='Existing YOLOX sampled-frame analysis JSON')
    parser.add_argument('--config', type=Path, required=True, help='Authorized ROI density configuration JSON')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        document = json.loads(args.analysis_json.read_text())
        config = json.loads(args.config.read_text())
        result = analyze_detection_document(document, config)
    except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    summary = {
        'source_video_identifier': result['provenance']['source_video_identifier'],
        'duration_seconds': result['input_duration_seconds'],
        'window_summaries': [
            {key: window[key] for key in ('window_started_at_seconds', 'window_ended_at_seconds', 'status', 'average_vehicles_present', 'peak_vehicles_present', 'condition', 'classification_status')}
            for window in result['windows']
        ],
    }
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
