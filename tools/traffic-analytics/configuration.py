"""Validation for normalized, video-specific offline analysis configuration."""
from math import isfinite


def validate_configuration(confidence, sampled_fps, roi, line, max_track_distance, max_missed_frames, direction):
    if not isfinite(confidence) or not 0 < confidence < 1:
        raise ValueError('confidence must be between 0 and 1')
    if not isfinite(sampled_fps) or not 0 < sampled_fps <= 10:
        raise ValueError('sampled_fps must be greater than 0 and at most 10')
    if not isfinite(max_track_distance) or max_track_distance <= 0 or max_missed_frames < 0:
        raise ValueError('tracking limits are invalid')
    if direction not in ('both', 'negative_to_positive', 'positive_to_negative'):
        raise ValueError('unsupported crossing direction')
    for name, values in (('roi', roi), ('counting_line', line)):
        if values and (len(values) != 4 or any(not isfinite(value) for value in values) or min(values) < 0 or max(values) > 1):
            raise ValueError(f'{name} values must be normalized between 0 and 1')
    if roi and (roi[2] <= 0 or roi[3] <= 0 or roi[0] + roi[2] > 1 or roi[1] + roi[3] > 1):
        raise ValueError('roi must fit within the normalized frame')
    if line and (line[0] == line[2] and line[1] == line[3]):
        raise ValueError('counting-line endpoints must differ')
