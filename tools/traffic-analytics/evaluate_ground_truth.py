#!/usr/bin/env python3
"""One-to-one crossing-event evaluation against a manually completed CSV."""
import argparse
import csv
import json
from pathlib import Path
from taxonomy import TRAFFIC_CATEGORY_BY_CLASS

CATEGORIES = {'LV', 'HV', 'MC', 'bicycle'}
DIRECTIONS = {'negative_to_positive', 'positive_to_negative'}
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


def evaluate(analysis, labels, tolerance_seconds=0.5):
    if tolerance_seconds < 0:
        raise ValueError('tolerance must be non-negative')
    if not labels:
        return {'ground_truth_available': False, 'metrics': None, 'note': 'No manual ground-truth events were supplied.'}
    predicted = analysis.get('crossing_events', [])
    candidates = []
    for label_index, label in enumerate(labels):
        for prediction_index, prediction in enumerate(predicted):
            category = prediction.get('traffic_category') or TRAFFIC_CATEGORY_BY_CLASS.get(prediction.get('class'))
            delta = abs(float(prediction['timestamp_seconds']) - label['timestamp_seconds'])
            if category == label['vehicle_category'] and prediction.get('direction') == label['direction'] and delta <= tolerance_seconds:
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
    return {
        'ground_truth_available': True,
        'metrics': {
            'true_positive': tp, 'false_positive': fp, 'false_negative': fn,
            'precision': precision, 'recall': recall,
            'f1': 2 * precision * recall / (precision + recall) if precision + recall else 0,
            'absolute_count_error': abs(len(predicted) - len(labels)),
            'by_vehicle_category': per_category,
            'matching_rule': f'one-to-one class/category and direction match within {tolerance_seconds:g} seconds',
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('analysis', type=Path)
    parser.add_argument('ground_truth_csv', type=Path)
    parser.add_argument('--tolerance-seconds', type=float, default=0.5)
    args = parser.parse_args()
    result = evaluate(json.loads(args.analysis.read_text()), read_labels(args.ground_truth_csv), args.tolerance_seconds)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
