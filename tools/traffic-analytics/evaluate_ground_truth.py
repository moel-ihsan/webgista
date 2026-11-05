#!/usr/bin/env python3
"""One-to-one event evaluation gated by a complete human-reviewed JSON package."""
import argparse
import csv
import json
from math import ceil, isfinite
from pathlib import Path
from taxonomy import TRAFFIC_CATEGORY_BY_CLASS

CATEGORIES = {'LV', 'HV', 'MC', 'bicycle'}
DIRECTIONS = {'negative_to_positive', 'positive_to_negative'}
DIAGNOSTICS = {'unclassified', 'not_detected', 'detection_not_tracked', 'fragmented_track', 'merged_tracks', 'wrong_direction', 'outside_counting_segment', 'duplicate_crossing', 'other'}
FIELDS = ('event_id', 'vehicle_category', 'direction', 'timestamp_seconds', 'frame_index')


def read_labels(path):
    with Path(path).open(newline='') as source:
        rows = list(csv.DictReader(source))
    labels, identifiers = [], set()
    for row in rows:
        if not any((row.get(field) or '').strip() for field in FIELDS):
            continue
        event_id = row['event_id'].strip()
        category = row['vehicle_category'].strip()
        direction = row['direction'].strip()
        timestamp = float(row['timestamp_seconds'])
        frame_index = int(row['frame_index'])
        if not event_id or event_id in identifiers or category not in CATEGORIES or direction not in DIRECTIONS:
            raise ValueError('labels need unique event IDs, supported categories, and crossing directions')
        if timestamp < 0 or frame_index < 0:
            raise ValueError('label timestamps and frame indices must be non-negative')
        identifiers.add(event_id)
        labels.append({'event_id': event_id, 'vehicle_category': category, 'direction': direction, 'timestamp_seconds': timestamp, 'frame_index': frame_index})
    return labels


def unavailable(reason):
    return {'ground_truth_available': False, 'metrics': None, 'note': reason}


def evaluate(analysis, labels, tolerance_seconds=0.5, ground_truth_complete=False):
    if not isfinite(tolerance_seconds) or tolerance_seconds < 0:
        raise ValueError('tolerance must be non-negative')
    if not labels and not ground_truth_complete:
        return unavailable('No complete manual ground-truth review was supplied.')
    predicted = analysis.get('crossing_events', [])
    candidates = []
    for label_index, label in enumerate(labels):
        for prediction_index, prediction in enumerate(predicted):
            category = prediction.get('traffic_category') or TRAFFIC_CATEGORY_BY_CLASS.get(prediction.get('class'))
            delta = abs(float(prediction['timestamp_seconds']) - label['timestamp_seconds'])
            same_vehicle_class = not label.get('vehicle_class') or prediction.get('class') == label['vehicle_class']
            if same_vehicle_class and category == label['vehicle_category'] and prediction.get('direction') == label['direction'] and delta <= tolerance_seconds:
                candidates.append((delta, label_index, prediction_index))
    matched_labels, matched_predictions = set(), set()
    for _, label_index, prediction_index in sorted(candidates):
        if label_index not in matched_labels and prediction_index not in matched_predictions:
            matched_labels.add(label_index)
            matched_predictions.add(prediction_index)
    tp, fp, fn = len(matched_labels), len(predicted) - len(matched_predictions), len(labels) - len(matched_labels)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    per_category = {}
    categories = sorted({label['vehicle_category'] for label in labels} | {
        event.get('traffic_category') or TRAFFIC_CATEGORY_BY_CLASS.get(event.get('class'), 'unsupported')
        for event in predicted
    })
    for category in categories:
        label_count = sum(label['vehicle_category'] == category for label in labels)
        prediction_count = sum((event.get('traffic_category') or TRAFFIC_CATEGORY_BY_CLASS.get(event.get('class'))) == category for event in predicted)
        category_tp = sum(labels[index]['vehicle_category'] == category for index in matched_labels)
        per_category[category] = {'true_positive': category_tp, 'false_positive': prediction_count - category_tp, 'false_negative': label_count - category_tp, 'absolute_count_error': abs(prediction_count - label_count)}
    per_class = {}
    classes = sorted({label.get('vehicle_class') for label in labels if label.get('vehicle_class')} | {event.get('class') for event in predicted})
    for vehicle_class in classes:
        label_count = sum(label.get('vehicle_class') == vehicle_class for label in labels)
        prediction_count = sum(event.get('class') == vehicle_class for event in predicted)
        class_tp = sum(labels[index].get('vehicle_class') == vehicle_class for index in matched_labels)
        per_class[vehicle_class] = {'true_positive': class_tp, 'false_positive': prediction_count - class_tp, 'false_negative': label_count - class_tp, 'absolute_count_error': abs(prediction_count - label_count)}
    per_direction = {}
    directions = sorted({label['direction'] for label in labels} | {event.get('direction') for event in predicted})
    for direction in directions:
        label_count = sum(label['direction'] == direction for label in labels)
        prediction_count = sum(event.get('direction') == direction for event in predicted)
        direction_tp = sum(labels[index]['direction'] == direction for index in matched_labels)
        per_direction[direction] = {'true_positive': direction_tp, 'false_positive': prediction_count - direction_tp, 'false_negative': label_count - direction_tp, 'absolute_count_error': abs(prediction_count - label_count)}
    return {
        'ground_truth_available': True,
        'metrics': {
            'true_positive': tp, 'false_positive': fp, 'false_negative': fn,
            'precision': precision, 'recall': recall,
            'f1': 2 * precision * recall / (precision + recall) if precision + recall else 0,
            'absolute_count_error': abs(len(predicted) - len(labels)),
            'by_vehicle_class': per_class,
            'by_vehicle_category': per_category,
            'by_direction': per_direction,
            'matching_rule': f'one-to-one class/category and direction match within {tolerance_seconds:g} seconds',
        },
    }


def evaluate_review_package(analysis, review, tolerance_seconds=0.5):
    if review.get('schema_version') != 'webgista.traffic-ground-truth.v1':
        return unavailable('Unsupported review package version.')
    if review.get('video', {}).get('id') != analysis.get('source_video_identifier'):
        return unavailable('Review package video ID does not match the analysis source.')
    if review.get('video', {}).get('source_sha256') != analysis.get('source_video_sha256'):
        return unavailable('Review package source SHA-256 does not match the analyzed video.')
    if not isinstance(review.get('reviewer'), str) or not review['reviewer'].strip():
        return unavailable('A reviewer ID is required for whole-clip ground truth.')
    progress = review.get('review_progress', {})
    if progress.get('full_clip_reviewed') is not True or progress.get('attested') is not True:
        return unavailable('The reviewer has not completed and attested whole-clip review.')
    duration = analysis.get('input_duration_seconds')
    source_fps = analysis.get('source_fps')
    source_frame_count = analysis.get('source_frame_count')
    reviewed_seconds = progress.get('reviewed_seconds')
    if (not isinstance(duration, (int, float)) or not isfinite(duration) or duration <= 0
            or not isinstance(source_fps, (int, float)) or not isfinite(source_fps) or source_fps <= 0
            or not isinstance(source_frame_count, int) or source_frame_count <= 0 or not isinstance(reviewed_seconds, list)):
        return unavailable('Review duration or coverage is invalid.')
    if any(type(second) is not int or second < 0 or second >= ceil(duration) for second in reviewed_seconds):
        return unavailable('Review coverage contains an invalid second.')
    if set(reviewed_seconds) != set(range(ceil(duration))):
        return unavailable('Whole-clip review coverage is incomplete.')
    events = review.get('events')
    if not isinstance(events, list):
        return unavailable('Review package events must be a list.')
    ids, labels, unresolved = set(), [], 0
    for event in events:
        if not isinstance(event, dict):
            return unavailable('Review events must be objects.')
        event_id = event.get('event_id')
        if not isinstance(event_id, str) or not event_id.strip() or event_id in ids:
            return unavailable('Review event IDs must be unique and present.')
        ids.add(event_id)
        diagnostic = event.get('diagnostic_category', 'unclassified')
        if not isinstance(diagnostic, str) or diagnostic not in DIAGNOSTICS:
            return unavailable(f'Event {event_id} has an invalid diagnostic category.')
        status = event.get('review_status')
        if status in ('unreviewed', 'uncertain'):
            unresolved += 1
            continue
        if status not in ('confirmed', 'corrected', 'rejected'):
            return unavailable(f'Event {event_id} has an invalid review status.')
        vehicle_class = event.get('vehicle_class')
        category = TRAFFIC_CATEGORY_BY_CLASS.get(vehicle_class)
        timestamp = event.get('timestamp_seconds')
        frame_index = event.get('frame_index')
        if (category is None or event.get('direction') not in DIRECTIONS
                or isinstance(timestamp, bool) or not isinstance(timestamp, (int, float)) or not isfinite(timestamp)
                or timestamp < 0 or timestamp > duration
                or type(frame_index) is not int or frame_index < 0 or frame_index >= source_frame_count
                or abs(frame_index - round(timestamp * source_fps)) > 1):
            return unavailable(f'Event {event_id} has an invalid class, direction, or timestamp.')
        if not event.get('reviewer') or not event.get('annotation_provenance'):
            return unavailable(f'Event {event_id} is missing reviewer provenance.')
        if status == 'rejected':
            continue
        labels.append({
            'event_id': event_id, 'vehicle_class': vehicle_class, 'vehicle_category': category,
            'direction': event['direction'], 'timestamp_seconds': float(event['timestamp_seconds']),
            'frame_index': event.get('frame_index'),
        })
    if unresolved:
        return unavailable(f'{unresolved} annotations remain unreviewed or uncertain.')
    result = evaluate(analysis, labels, tolerance_seconds, ground_truth_complete=True)
    result['review_provenance'] = {
        'video_id': review['video']['id'], 'source_sha256': review['video']['source_sha256'],
        'reviewer': review.get('reviewer'), 'full_clip_reviewed': True,
        'confirmed_or_corrected_events': len(labels),
        'rejected_candidates': sum(event.get('review_status') == 'rejected' for event in events),
    }
    result['review_diagnostics'] = {
        category: sum(event.get('diagnostic_category', 'unclassified') == category for event in events)
        for category in sorted(DIAGNOSTICS - {'unclassified'})
        if any(event.get('diagnostic_category') == category for event in events)
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('analysis', type=Path)
    parser.add_argument('ground_truth_review_json', type=Path)
    parser.add_argument('--tolerance-seconds', type=float, default=0.5)
    args = parser.parse_args()
    result = evaluate_review_package(json.loads(args.analysis.read_text()), json.loads(args.ground_truth_review_json.read_text()), args.tolerance_seconds)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
