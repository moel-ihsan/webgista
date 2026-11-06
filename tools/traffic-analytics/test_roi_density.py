import json
from pathlib import Path
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from analyze_roi_density import analyze_detection_document, load_authorized_config
from roi_density import PROCESSING_DEFAULTS, aggregate_windows, point_in_polygon, roi_image_coverage, validate_config


def config(**changes):
    value = {
        'schema_version': 'webgista.roi-density-config.v1', 'source_video_identifier': 'demo01', 'roi_type': 'rectangle',
        'roi_geometry': [0.25, 0.25, 0.5, 0.5], 'video_dimensions': {'width': 100, 'height': 100},
        'observation_window_seconds': 10, 'refresh_seconds': 10, 'sampled_fps': 5,
        'minimum_detection_confidence': 0.35,
        'included_classes': ['car', 'bus', 'truck', 'motorcycle'],
        'busy_threshold_vehicles': 3, 'minimum_valid_coverage': 0.8,
        'density_thresholds': None, 'calibration_status': 'uncalibrated',
        'calibration_note': '', 'configuration_version': 1,
    }
    value.update(changes)
    return value


def sample(time, count=0):
    return {
        'timestamp_seconds': time,
        'detections': [{'class': 'car', 'confidence': 0.9, 'bbox_xyxy': [0.4, 0.2, 0.6, 0.49]} for _ in range(count)],
        'roi_coverage': 0.1,
    }


class RoiDensityTest(unittest.TestCase):
    def test_supabase_config_read_uses_user_jwt_and_returns_saved_version(self):
        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return json.dumps([{'configuration': config(), 'configuration_version': 7}]).encode()

        with patch('analyze_roi_density.urlopen', return_value=Response()) as open_url:
            stored = load_authorized_config('a60eb814-12dc-42df-b1f8-14234631dbeb', {
                'WEBGISTA_SUPABASE_URL': 'https://dev.example.supabase.co/',
                'WEBGISTA_SUPABASE_ANON_KEY': 'publishable-key',
                'WEBGISTA_USER_ACCESS_TOKEN': 'user-jwt',
            })
        request = open_url.call_args.args[0]
        self.assertEqual(request.headers['Authorization'], 'Bearer user-jwt')
        self.assertIn('cctv_id=eq.a60eb814-12dc-42df-b1f8-14234631dbeb', request.full_url)
        self.assertEqual(stored['configuration_version'], 7)
        self.assertEqual(stored['camera_id'], 'a60eb814-12dc-42df-b1f8-14234631dbeb')

    def test_supabase_config_read_requires_an_authorized_user_token_without_logging_it(self):
        with self.assertRaisesRegex(ValueError, 'authorized WEBGISTA_USER_ACCESS_TOKEN'):
            load_authorized_config('a60eb814-12dc-42df-b1f8-14234631dbeb', {})

    def test_supabase_authorization_failure_does_not_echo_credentials(self):
        with patch('analyze_roi_density.urlopen', side_effect=HTTPError('https://example.test', 401, 'unauthorized', {}, None)):
            with self.assertRaisesRegex(ValueError, 'HTTP 401') as error:
                load_authorized_config('a60eb814-12dc-42df-b1f8-14234631dbeb', {
                    'WEBGISTA_SUPABASE_URL': 'https://dev.example.supabase.co',
                    'WEBGISTA_SUPABASE_ANON_KEY': 'publishable-key',
                    'WEBGISTA_USER_ACCESS_TOKEN': 'private-user-jwt',
                })
        self.assertNotIn('private-user-jwt', str(error.exception))

    def test_committed_demo_density_outputs_reproduce_from_sources_and_configs(self):
        root = Path(__file__).resolve().parents[2]
        for sample_id in ('traffic_sample_01', 'traffic_sample_02'):
            analysis = json.loads((root / 'apps/web/src/data/traffic-demo' / f'{sample_id}.analysis.json').read_text())
            demo_config = json.loads((root / 'tools/traffic-analytics/demo_configs' / f'{sample_id}_roi.json').read_text())
            expected = json.loads((root / 'apps/web/src/data/traffic-demo' / f'{sample_id}.roi-density.json').read_text())
            actual = analyze_detection_document(analysis, demo_config)
            self.assertEqual(actual, expected)
            self.assertEqual([window['status'] for window in actual['windows']], ['complete', 'complete', 'partial'])
            self.assertTrue(all(window['condition'] is None for window in actual['windows']))

    def test_rectangle_and_polygon_validation_and_self_intersection(self):
        polygon_config = config(roi_type='polygon', roi_geometry=[[0, 0], [1, 0], [0.8, 1], [0, 1]])
        self.assertEqual(len(validate_config(polygon_config)), 4)
        self.assertTrue(point_in_polygon((0.5, 0.5), polygon_config['roi_geometry']))
        for points in ([[0, 0], [1, 1], [0, 1], [1, 0]], [[0, 0], [1.1, 0], [1, 1]]):
            with self.assertRaises(ValueError):
                validate_config({**polygon_config, 'roi_geometry': points})
        with self.assertRaises(ValueError):
            validate_config(config(roi_geometry=[0.8, 0.8, 0.4, 0.4]))

    def test_detection_presence_filters_class_confidence_and_bottom_center(self):
        detections = [
            {'class': 'car', 'confidence': .9, 'bbox_xyxy': [0.4, 0.2, 0.6, 0.49]},
            {'class': 'motorcycle', 'confidence': .34, 'bbox_xyxy': [0.4, 0.2, 0.6, 0.49]},
            {'class': 'person', 'confidence': .99, 'bbox_xyxy': [0.4, 0.2, 0.6, 0.49]},
            {'class': 'truck', 'confidence': .9, 'bbox_xyxy': [0.4, 0.2, 0.6, 0.8]},
        ]
        result = aggregate_windows([{'timestamp_seconds': 0, 'detections': detections, 'roi_coverage': .2}], 10, config(), {})
        window = result['windows'][0]
        self.assertEqual(window['class_statistics']['car']['peak'], 1)
        self.assertEqual(window['class_statistics']['truck']['peak'], 0)
        self.assertEqual(window['data_quality']['missing_samples'], 49)

    def test_two_complete_windows_and_actual_partial_window(self):
        samples = [sample(index / 5, 1 if index < 50 else 3) for index in range(115)]
        result = aggregate_windows(samples, 23.023, config(minimum_valid_coverage=.8), {'record_kind': 'demo_video_analysis'})
        self.assertEqual([window['status'] for window in result['windows']], ['complete', 'complete', 'partial'])
        self.assertAlmostEqual(result['windows'][0]['average_vehicles_present'], 1)
        self.assertAlmostEqual(result['windows'][1]['average_vehicles_present'], 3)
        self.assertAlmostEqual(result['windows'][0]['data_quality']['effective_observation_seconds'], 10)
        self.assertEqual(result['windows'][2]['condition'], None)
        self.assertEqual(result['windows'][2]['classification_status'], 'insufficient_duration')

    def test_refresh_cadence_generates_time_weighted_overlapping_windows(self):
        rows = [sample(index / 5, 1) for index in range(100)]
        result = aggregate_windows(rows, 20, config(refresh_seconds=5), {})['windows']
        self.assertEqual([window['window_started_at_seconds'] for window in result], [0, 5, 10, 15])
        self.assertEqual([window['status'] for window in result], ['complete', 'complete', 'complete', 'partial'])
        with self.assertRaisesRegex(ValueError, 'cannot exceed'):
            validate_config(config(refresh_seconds=11))

    def test_missing_samples_reduce_time_coverage_instead_of_becoming_zero_counts(self):
        result = aggregate_windows([sample(index / 5) for index in range(0, 50, 2)], 10, config(), {})['windows'][0]
        self.assertEqual(result['average_vehicles_present'], 0)
        self.assertEqual(result['data_quality']['valid_samples'], 25)
        self.assertEqual(result['data_quality']['effective_observation_seconds'], 5)
        self.assertEqual(result['classification_status'], 'insufficient_coverage')
        self.assertIsNone(result['condition'])

    def test_time_weighting_counts_presence_not_frame_detection_sums(self):
        rows = [sample(time, count) for time, count in [(0, 1), (.4, 3), (.6, 3), (.8, 1)]]
        result = aggregate_windows(rows, 1, config(observation_window_seconds=1, refresh_seconds=1, minimum_valid_coverage=.8), {})['windows'][0]
        self.assertAlmostEqual(result['average_vehicles_present'], 2)
        self.assertEqual(result['peak_vehicles_present'], 3)
        self.assertEqual(result['data_quality']['effective_observation_seconds'], .8)

    def test_window_peak_is_maximum_simultaneous_presence_not_sum_of_class_peaks(self):
        car = {'class': 'car', 'confidence': .9, 'bbox_xyxy': [.4, .2, .6, .49]}
        bus = {'class': 'bus', 'confidence': .9, 'bbox_xyxy': [.4, .2, .6, .49]}
        result = aggregate_windows([
            {'timestamp_seconds': index / 5, 'detections': [car] if index < 25 else [bus]}
            for index in range(50)
        ], 10, config(), {})['windows'][0]
        self.assertEqual(result['peak_vehicles_present'], 1)
        self.assertEqual(result['class_statistics']['car']['peak'], 1)
        self.assertEqual(result['class_statistics']['bus']['peak'], 1)
        self.assertEqual(result['traffic_category_statistics']['HV']['peak'], 1)
        self.assertEqual(result['traffic_category_statistics']['LV']['peak'], 1)

    def test_duplicate_or_out_of_range_samples_and_invalid_boxes_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'unique'):
            aggregate_windows([sample(0), sample(0)], 10, config(), {})
        with self.assertRaisesRegex(ValueError, 'inside the video'):
            aggregate_windows([sample(10)], 10, config(), {})
        bad_box = {'class': 'car', 'confidence': .9, 'bbox_xyxy': [0.2, 0.2, 1.1, 0.8]}
        with self.assertRaisesRegex(ValueError, 'normalized'):
            aggregate_windows([{'timestamp_seconds': 0, 'detections': [bad_box]}], 10, config(), {})

    def test_roi_image_coverage_uses_union_of_clipped_vehicle_boxes(self):
        box = {'class': 'car', 'confidence': .9, 'bbox_xyxy': [25, 25, 75, 75]}
        coverage = roi_image_coverage(100, 100, [[0, 0], [1, 0], [1, 1], [0, 1]], [box, box], ['car'], .35)
        self.assertAlmostEqual(coverage, .25, delta=.01)

    def test_zero_presence_is_valid_but_does_not_fabricate_mkji_condition(self):
        thresholds = [1, 2, 3, 4, 5]
        rows = [sample(index / 5) for index in range(50)]
        result = aggregate_windows(rows, 10, config(density_thresholds=thresholds, calibration_status='experimental'), {})['windows'][0]
        self.assertEqual(result['average_vehicles_present'], 0)
        self.assertIsNone(result['condition'])
        self.assertEqual(result['classification_status'], 'no_data')
        self.assertIn('vehicle-flow', result['condition_reason'])

    def test_configuration_rejects_bad_thresholds_and_false_calibrated_state(self):
        with self.assertRaises(ValueError):
            validate_config(config(density_thresholds=[1, 1, 2, 3, 4], calibration_status='experimental'))
        with self.assertRaises(ValueError):
            validate_config(config(density_thresholds=[1, 2, 3, 4, 5], calibration_status='calibrated', calibration_note='too short'))

    def test_derived_analysis_keeps_demo_provenance_and_never_classifies_presence_as_mkji(self):
        document = {
            'record_kind': 'demo_video_analysis', 'is_live_cctv': False,
            'source_video_identifier': 'demo01', 'source_video_sha256': 'sha',
            'video_dimensions': {'width': 100, 'height': 100}, 'input_duration_seconds': 10,
            'model': {'name': 'YOLOX-S'}, 'schema_version': 'webgista.traffic-analysis.v2',
            'frames': [{'offset_seconds': index / 5, 'detections': [{'class': 'car', 'confidence': .9, 'bbox_xyxy': [40, 20, 60, 49]}]} for index in range(50)],
        }
        result = analyze_detection_document(document, config(
            observation_window_seconds=60, refresh_seconds=30, sampled_fps=2,
            included_classes=['bicycle'], density_thresholds=[.5, 1.5, 2, 3, 4], calibration_status='experimental',
        ))
        self.assertFalse(result['provenance']['is_live_cctv'])
        self.assertEqual(result['provenance']['model']['name'], 'YOLOX-S')
        self.assertEqual(result['observation_window_seconds'], 10)
        self.assertEqual(result['refresh_seconds'], 10)
        self.assertEqual(result['sampled_fps'], 5)
        self.assertEqual(result['configuration_snapshot']['included_classes'], ['car', 'motorcycle', 'bus', 'truck'])
        self.assertEqual(result['windows'][0]['status'], 'complete')
        self.assertIsNone(result['windows'][0]['condition'])
        self.assertEqual(result['windows'][0]['classification_status'], 'no_data')

    def test_processing_defaults_are_backend_owned(self):
        self.assertEqual(PROCESSING_DEFAULTS['observation_window_seconds'], 10)
        self.assertEqual(PROCESSING_DEFAULTS['refresh_seconds'], 10)
        self.assertEqual(PROCESSING_DEFAULTS['sampled_fps'], 5)
        self.assertEqual(PROCESSING_DEFAULTS['included_classes'], ['car', 'motorcycle', 'bus', 'truck'])

    def test_camera_export_binds_source_and_preserves_saved_configuration_version(self):
        document = {
            'record_kind': 'authorized_video_analysis', 'is_live_cctv': False,
            'source_video_identifier': 'camera-video-01', 'source_video_sha256': 'sha',
            'video_dimensions': {'width': 100, 'height': 100}, 'input_duration_seconds': 10,
            'frames': [{'offset_seconds': index / 5, 'detections': []} for index in range(50)],
        }
        exported = config(camera_id='cctv-123', source_video_identifier='camera-video-01', configuration_version=4)
        result = analyze_detection_document(document, exported)
        self.assertEqual(result['provenance']['camera_id'], 'cctv-123')
        self.assertEqual(result['provenance']['source_video_identifier'], 'camera-video-01')
        self.assertEqual(result['configuration_version'], 4)

    def test_camera_export_rejects_a_different_source_video(self):
        document = {
            'record_kind': 'authorized_video_analysis', 'source_video_identifier': 'another-video',
            'source_video_sha256': 'sha', 'video_dimensions': {'width': 100, 'height': 100},
            'input_duration_seconds': 10, 'frames': [],
        }
        exported = config(camera_id='cctv-123', source_video_identifier='camera-video-01', configuration_version=4)
        with self.assertRaisesRegex(ValueError, 'does not match'):
            analyze_detection_document(document, exported)

    def test_unbound_roi_configuration_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'source_video_identifier is required'):
            validate_config(config(source_video_identifier=''))


if __name__ == '__main__':
    unittest.main()
