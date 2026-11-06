select
  job.id as job_id,
  job.cctv_id,
  job.source_video_identifier,
  job.source_video_sha256,
  job.detection_artifact_version,
  job.configuration_version,
  job.analysis_method_version,
  job.status,
  job.created_at,
  job.started_at,
  job.finished_at,
  job.failure_reason,
  count(result.id)::integer as result_window_count,
  coalesce(
    jsonb_agg(jsonb_build_object(
      'window_started_at_seconds', result.window_started_at_seconds,
      'window_ended_at_seconds', result.window_ended_at_seconds,
      'configuration_version', result.summary -> 'configuration_version',
      'source_video_identifier', result.summary -> 'source_video_identifier',
      'source_video_sha256', result.summary -> 'source_video_sha256',
      'status', result.summary -> 'status',
      'average_vehicles_present', result.summary -> 'average_vehicles_present',
      'peak_vehicles_present', result.summary -> 'peak_vehicles_present',
      'valid_samples', result.summary #>> '{data_quality,valid_samples}'
    ) order by result.window_started_at_seconds) filter (where result.id is not null),
    '[]'::jsonb
  ) as result_windows
from public.cctv_roi_analysis_jobs job
left join public.cctv_roi_analysis_results result on result.job_id = job.id
where job.id = 'f0c0054f-da3b-45c2-8ead-f8bf2c82dfbe'
  and job.cctv_id = 'dec221d0-87ae-4194-a3ab-bf60eb4d041f'
  and job.source_video_identifier = 'traffic_sample_02'
  and job.configuration_version = 3
  and job.analysis_method_version = 'roi_density_v1'
group by job.id;
