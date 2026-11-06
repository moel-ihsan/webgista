"""Time-weighted vehicle presence in a normalized video ROI."""
from math import isfinite

import numpy as np

CLASSES = ('car', 'bus', 'truck', 'motorcycle', 'bicycle')
PROCESSING_DEFAULTS = {
    'observation_window_seconds': 10,
    'refresh_seconds': 10,
    'sampled_fps': 5,
    'minimum_detection_confidence': 0.35,
    'included_classes': ['car', 'motorcycle', 'bus', 'truck'],
    'busy_threshold_vehicles': 0,
    'minimum_valid_coverage': 0.8,
    'density_thresholds': None,
    'calibration_status': 'uncalibrated',
    'calibration_note': '',
}


def apply_processing_defaults(config):
    """Keep editable storage limited to ROI geometry; processing policy is backend-owned."""
    return {**config, **PROCESSING_DEFAULTS}


def rectangle_points(rectangle):
    if not isinstance(rectangle, (list, tuple)) or len(rectangle) != 4:
        raise ValueError('rectangle must be [x, y, width, height]')
    x, y, width, height = rectangle
    values = (x, y, width, height)
    if any(not isinstance(value, (int, float)) or not isfinite(value) for value in values):
        raise ValueError('rectangle values must be finite numbers')
    if min(x, y) < 0 or min(width, height) <= 0 or x + width > 1 or y + height > 1:
        raise ValueError('rectangle must fit inside normalized video coordinates')
    return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]


def point_in_polygon(point, polygon):
    def on_segment(start, end):
        cross = (point[0] - start[0]) * (end[1] - start[1]) - (point[1] - start[1]) * (end[0] - start[0])
        return abs(cross) <= 1e-12 and min(start[0], end[0]) <= point[0] <= max(start[0], end[0]) and min(start[1], end[1]) <= point[1] <= max(start[1], end[1])

    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        x1, y1 = previous
        x2, y2 = current
        if on_segment(previous, current):
            return True
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
        previous = current
    return inside


def validate_polygon(polygon):
    if not isinstance(polygon, (list, tuple)) or not 3 <= len(polygon) <= 64:
        raise ValueError('ROI polygon must contain 3 to 64 vertices')
    points = []
    for point in polygon:
        if not isinstance(point, (list, tuple)) or len(point) != 2:
            raise ValueError('ROI vertices must be normalized [x, y] pairs')
        if any(not isinstance(value, (int, float)) or not isfinite(value) or not 0 <= value <= 1 for value in point):
            raise ValueError('ROI vertices must be finite and between 0 and 1')
        points.append(list(point))
    if len({tuple(point) for point in points}) < 3 or polygon_area(points) <= 1e-8:
        raise ValueError('ROI polygon must have a non-zero area')
    if any(points[index] == points[(index + 1) % len(points)] for index in range(len(points))):
        raise ValueError('ROI polygon cannot contain zero-length edges')
    if self_intersects(points):
        raise ValueError('ROI polygon cannot self-intersect')
    return points


def polygon_area(points):
    return abs(sum(points[index][0] * points[(index + 1) % len(points)][1]
                   - points[(index + 1) % len(points)][0] * points[index][1]
                   for index in range(len(points))) / 2)


def self_intersects(points):
    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    def crosses(a, b, c, d):
        def on_segment(start, point, end):
            return min(start[0], end[0]) <= point[0] <= max(start[0], end[0]) and min(start[1], end[1]) <= point[1] <= max(start[1], end[1])
        ab_c, ab_d = orient(a, b, c), orient(a, b, d)
        cd_a, cd_b = orient(c, d, a), orient(c, d, b)
        return ((ab_c * ab_d < 0 and cd_a * cd_b < 0)
                or (ab_c == 0 and on_segment(a, c, b)) or (ab_d == 0 and on_segment(a, d, b))
                or (cd_a == 0 and on_segment(c, a, d)) or (cd_b == 0 and on_segment(c, b, d)))

    size = len(points)
    for first in range(size):
        a, b = points[first], points[(first + 1) % size]
        for second in range(first + 1, size):
            if second in (first, (first + 1) % size) or (second + 1) % size == first:
                continue
            if crosses(a, b, points[second], points[(second + 1) % size]):
                return True
    return False


def validate_config(config):
    if not isinstance(config, dict) or config.get('schema_version') != 'webgista.roi-density-config.v1':
        raise ValueError('unsupported ROI density configuration')
    if not isinstance(config.get('source_video_identifier'), str) or not config['source_video_identifier'].strip():
        raise ValueError('source_video_identifier is required')
    if config.get('roi_type') == 'rectangle':
        polygon = rectangle_points(config.get('roi_geometry'))
    elif config.get('roi_type') == 'polygon':
        polygon = validate_polygon(config.get('roi_geometry'))
    else:
        raise ValueError('ROI type must be rectangle or polygon')
    dimensions = config.get('video_dimensions')
    if not isinstance(dimensions, dict) or any(type(dimensions.get(key)) is not int or dimensions[key] <= 0 for key in ('width', 'height')):
        raise ValueError('video dimensions must be positive integers')
    for key, low, high in (
        ('observation_window_seconds', 1, 300), ('refresh_seconds', 1, 300),
        ('sampled_fps', 0.1, 10), ('minimum_detection_confidence', 0, 1),
        ('busy_threshold_vehicles', 0, 1000), ('minimum_valid_coverage', 0.5, 1),
    ):
        value = config.get(key)
        if not isinstance(value, (int, float)) or not isfinite(value) or not low <= value <= high:
            raise ValueError(f'{key} must be between {low} and {high}')
    if config['refresh_seconds'] > config['observation_window_seconds']:
        raise ValueError('refresh_seconds cannot exceed the observation window')
    included = config.get('included_classes')
    if not isinstance(included, list) or not included or len(set(included)) != len(included) or any(item not in CLASSES for item in included):
        raise ValueError('included_classes must contain supported vehicle classes')
    thresholds = config.get('density_thresholds')
    calibration = config.get('calibration_status')
    if calibration not in ('uncalibrated', 'experimental', 'calibrated'):
        raise ValueError('invalid calibration status')
    if thresholds is not None:
        if not isinstance(thresholds, list) or len(thresholds) != 5 or any(
            not isinstance(value, (int, float)) or not isfinite(value) or value < 0 for value in thresholds
        ) or any(left >= right for left, right in zip(thresholds, thresholds[1:])):
            raise ValueError('density thresholds must be five strictly increasing non-negative values')
    elif calibration != 'uncalibrated':
        raise ValueError('thresholds are required for a calibrated or experimental preset')
    if calibration == 'calibrated' and len((config.get('calibration_note') or '').strip()) < 12:
        raise ValueError('calibrated status requires a calibration note of at least 12 characters')
    return polygon


def bottom_center_in_roi(detection, polygon):
    x1, y1, x2, y2 = detection['bbox_xyxy']
    return point_in_polygon(((x1 + x2) / 2, y2), polygon)


def roi_image_coverage(width, height, polygon, detections, included_classes, confidence_threshold):
    """Raster estimate of bbox-union pixels clipped to the ROI, not road occupancy."""
    scale = min(1.0, 320 / width, 180 / height)
    grid_width, grid_height = max(1, round(width * scale)), max(1, round(height * scale))
    xs = (np.arange(grid_width) + 0.5) / grid_width
    ys = (np.arange(grid_height) + 0.5) / grid_height
    xx, yy = np.meshgrid(xs, ys)
    roi_mask = np.zeros((grid_height, grid_width), dtype=bool)
    for row in range(len(polygon)):
        x1, y1 = polygon[row - 1]
        x2, y2 = polygon[row]
        intersects = (y1 > yy) != (y2 > yy)
        boundary_x = (x2 - x1) * (yy - y1) / ((y2 - y1) or 1e-30) + x1
        roi_mask ^= intersects & (xx < boundary_x)
    roi_pixels = int(roi_mask.sum())
    if not roi_pixels:
        return None
    vehicle_mask = np.zeros_like(roi_mask)
    for detection in detections:
        if detection.get('class') not in included_classes or detection.get('confidence', 0) < confidence_threshold:
            continue
        x1, y1, x2, y2 = detection['bbox_xyxy']
        vehicle_mask |= (xx >= x1 / width) & (xx < x2 / width) & (yy >= y1 / height) & (yy < y2 / height)
    return float((vehicle_mask & roi_mask).sum()) / roi_pixels


def aggregate_windows(samples, duration_seconds, config, source):
    polygon = validate_config(config)
    if not isinstance(duration_seconds, (int, float)) or not isfinite(duration_seconds) or duration_seconds <= 0:
        raise ValueError('video duration must be a finite positive number')
    window_seconds = float(config['observation_window_seconds'])
    sample_period = 1 / float(config['sampled_fps'])
    windows = []
    start = 0.0
    sorted_samples = []
    ordered_samples = sorted(samples, key=lambda row: row['timestamp_seconds'])
    previous_timestamp = None
    for sample in ordered_samples:
        timestamp = sample['timestamp_seconds']
        if not isinstance(timestamp, (int, float)) or not isfinite(timestamp) or timestamp < 0 or timestamp >= duration_seconds:
            raise ValueError('sample timestamps must be finite and inside the video duration')
        if previous_timestamp == timestamp:
            raise ValueError('sample timestamps must be unique')
        previous_timestamp = timestamp
        counts = {vehicle_class: 0 for vehicle_class in CLASSES}
        for detection in sample.get('detections', []):
            if detection.get('class') not in config['included_classes']:
                continue
            confidence = detection.get('confidence')
            if not isinstance(confidence, (int, float)) or not isfinite(confidence) or not 0 <= confidence <= 1:
                raise ValueError('detection confidence must be between zero and one')
            if confidence < config['minimum_detection_confidence']:
                continue
            box = detection.get('bbox_xyxy')
            if not isinstance(box, (list, tuple)) or len(box) != 4 or any(not isinstance(value, (int, float)) or not isfinite(value) for value in box):
                raise ValueError('detection bounding boxes must contain four finite coordinates')
            x1, y1, x2, y2 = box
            if not 0 <= x1 < x2 <= 1 or not 0 <= y1 < y2 <= 1:
                raise ValueError('detection bounding boxes must be ordered and normalized to the video')
            if bottom_center_in_roi(detection, polygon):
                counts[detection['class']] += 1
        coverage = sample.get('roi_coverage', 0)
        if coverage is not None and (not isinstance(coverage, (int, float)) or not isfinite(coverage) or not 0 <= coverage <= 1):
            raise ValueError('ROI image coverage must be between zero and one')
        sorted_samples.append({
            'timestamp_seconds': timestamp, 'counts': counts,
            'roi_coverage': coverage,
        })
    while start < duration_seconds:
        end = min(start + window_seconds, duration_seconds)
        complete = end - start >= window_seconds - 1e-6
        selected = [sample for sample in sorted_samples if start <= sample['timestamp_seconds'] < end]

        expected = max(0, int(round((end - start) * config['sampled_fps'])))
        coverage_seconds = 0.0
        weighted = {vehicle_class: 0.0 for vehicle_class in CLASSES}
        peak = {vehicle_class: 0 for vehicle_class in CLASSES}
        weighted_categories = {'LV': 0.0, 'HV': 0.0, 'MC': 0.0, 'bicycle': 0.0}
        peak_categories = {'LV': 0, 'HV': 0, 'MC': 0, 'bicycle': 0}
        peak_total = 0
        coverage_weighted = 0.0
        busy_seconds = 0.0
        for index, sample in enumerate(selected):
            counts = sample['counts']
            next_time = selected[index + 1]['timestamp_seconds'] if index + 1 < len(selected) else end
            weight = min(sample_period, max(0, next_time - sample['timestamp_seconds']), end - sample['timestamp_seconds'])
            coverage_seconds += weight
            for vehicle_class, count in counts.items():
                weighted[vehicle_class] += count * weight
                peak[vehicle_class] = max(peak[vehicle_class], count)
            category_counts = {
                'LV': counts['car'], 'HV': counts['bus'] + counts['truck'],
                'MC': counts['motorcycle'], 'bicycle': counts['bicycle'],
            }
            for category, count in category_counts.items():
                weighted_categories[category] += count * weight
                peak_categories[category] = max(peak_categories[category], count)
            total = sum(counts.values())
            peak_total = max(peak_total, total)
            if total > config['busy_threshold_vehicles']:
                busy_seconds += weight
            coverage_weighted += float(sample.get('roi_coverage', 0)) * weight

        valid_samples = len(selected)
        effective_coverage = coverage_seconds / max(end - start, 1e-9)
        valid = complete and valid_samples > 0 and effective_coverage >= config['minimum_valid_coverage']
        average = {vehicle_class: weighted[vehicle_class] / coverage_seconds if coverage_seconds else None for vehicle_class in CLASSES}
        average_total = sum(average.values()) if coverage_seconds else None
        windows.append({
            'window_started_at_seconds': round(start, 3), 'window_ended_at_seconds': round(end, 3),
            'window_duration_seconds': round(end - start, 3), 'status': 'complete' if complete else 'partial',
            'condition': None,
            'classification_status': 'no_data' if valid else 'insufficient_duration' if not complete else 'insufficient_coverage',
            'condition_reason': 'No validated vehicle-flow measurement and camera-specific road capacity are available for MKJI V/C.' if valid else
                'The interval is shorter than the required 10 seconds.' if not complete else
                'Valid sampled-frame coverage is below the required minimum.',
            'average_vehicles_present': round(average_total, 4) if average_total is not None else None,
            'peak_vehicles_present': peak_total if valid_samples else None,
            'class_statistics': {vehicle_class: {'average': round(average[vehicle_class], 4) if average[vehicle_class] is not None else None, 'peak': peak[vehicle_class]} for vehicle_class in CLASSES},
            'traffic_category_statistics': {
                category: {
                    'average': round(weighted_categories[category] / coverage_seconds, 4) if coverage_seconds else None,
                    'peak': peak_categories[category],
                }
                for category in ('LV', 'HV', 'MC', 'bicycle')
            },
            'busy_duration_seconds': round(busy_seconds, 3),
            'busy_duration_percentage': round(100 * busy_seconds / coverage_seconds, 2) if coverage_seconds else None,
            'roi_image_coverage_average': round(coverage_weighted / coverage_seconds, 5) if coverage_seconds else None,
            'data_quality': {
                'expected_samples': expected, 'valid_samples': valid_samples,
                'missing_samples': max(0, expected - valid_samples),
                'effective_observation_seconds': round(coverage_seconds, 3),
                'valid_observation_coverage': round(effective_coverage, 5),
                'processing_fps': config['sampled_fps'], 'sample_period_seconds': round(sample_period, 5),
            },
        })
        start += float(config['refresh_seconds'])
    return {
        'schema_version': 'webgista.roi-density-result.v1', 'analysis_method': 'roi_density_v1',
        'provenance': source, 'input_duration_seconds': round(duration_seconds, 3),
        'configuration_version': config.get('configuration_version', 1), 'roi_geometry': config['roi_geometry'],
        'configuration_snapshot': {key: value for key, value in config.items() if key != 'configuration_version'},
        'roi_type': config['roi_type'], 'video_dimensions': config['video_dimensions'],
        'observation_window_seconds': config['observation_window_seconds'],
        'refresh_seconds': config['refresh_seconds'], 'sampled_fps': config['sampled_fps'],
        'minimum_detection_confidence': config['minimum_detection_confidence'],
        'calibration_status': config['calibration_status'], 'density_thresholds': config['density_thresholds'],
        'traffic_condition_method': 'mkji_vc',
        'threshold_metric': 'ROI vehicle presence is descriptive only and is not used to classify traffic condition',
        'sampled_frame_metrics': [
            {
                'timestamp_seconds': round(sample['timestamp_seconds'], 3),
                'vehicle_presence_by_class': sample['counts'],
                'vehicle_presence_total': sum(sample['counts'].values()),
                'roi_image_coverage': round(sample['roi_coverage'], 5) if sample['roi_coverage'] is not None else None,
            }
            for sample in sorted_samples
        ],
        'windows': windows,
    }
