import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { roiAnalysisCorsHeaders } from '../_shared/roi_analysis_cors.mjs'
import { reaggregate } from '../_shared/roi_reaggregate.mjs'

declare const EdgeRuntime: { waitUntil<T>(promise: Promise<T>): Promise<T> }

const algorithm = 'roi_density_v1'
const demos = {
  '/traffic-demo/traffic_sample_01_annotated.mp4': {
    id: 'traffic_sample_01', file: 'traffic_sample_01.analysis.json',
    sourceHash: '84066ad4f0302f105cd28dbaef2f00a72f62b2ad4760c1030dc11efc7dd078c4',
    artifactHash: '4f0cbe29eb9a62a28ba7be60c8600354407fdc03ddf8d8ed976cd34983ddf6f1',
    model: { name: 'OpenCV Zoo YOLOX-S COCO', version: 'object_detection_yolox_2022nov_int8', sha256: '01a3b0f400b30bc1e45230e991b2e499ab42622485a330021947333fbaf03935' },
  },
  '/traffic-demo/traffic_sample_02_annotated.mp4': {
    id: 'traffic_sample_02', file: 'traffic_sample_02.analysis.json',
    sourceHash: '88f571acbd0f502f82c3e0f02a8f977ecf4a23f56debe68533f6026050a490ca',
    artifactHash: 'a09ed55977c7df92bc5def5b5ffa52c94a0192393a4524bdddc7fda51a28ba75',
    model: { name: 'OpenCV Zoo YOLOX-S COCO', version: 'object_detection_yolox_2022nov_int8', sha256: '01a3b0f400b30bc1e45230e991b2e499ab42622485a330021947333fbaf03935' },
  },
} as const

function response(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
}

async function processCachedJob(service: SupabaseClient<any>, job: { id: string; cctv_id: string }, source: (typeof demos)[keyof typeof demos], config: Record<string, unknown>, configurationVersion: number) {
  try {
    const { data: claimed, error: claimError } = await service.from('cctv_roi_analysis_jobs').update({ status: 'processing', started_at: new Date().toISOString(), failure_reason: null })
      .eq('id', job.id).in('status', ['pending', 'failed']).select('id').maybeSingle()
    if (claimError || !claimed) return

    const artifactResponse = await fetch(`https://webgista-v2.vercel.app/traffic-demo/${source.file}`, { signal: AbortSignal.timeout(8000) })
    if (!artifactResponse.ok || Number(artifactResponse.headers.get('content-length') ?? 0) > 1_000_000) throw new Error('Cached detection artifact is unavailable or exceeds the size limit.')
    const bytes = new Uint8Array(await artifactResponse.arrayBuffer())
    if (bytes.byteLength > 1_000_000) throw new Error('Cached detection artifact exceeds the size limit.')
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
    if (digest !== source.artifactHash) throw new Error('Cached detection artifact integrity check failed.')
    const document = JSON.parse(new TextDecoder().decode(bytes))
    if (document.source_video_sha256 !== source.sourceHash || document.source_video_identifier !== source.id) throw new Error('Detection artifact source identity check failed.')
    const result = reaggregate(document, config, configurationVersion)
    const processedAt = new Date().toISOString()
    const { error: completionError } = await service.rpc('complete_cctv_roi_analysis_job', { p_job_id: job.id, p_windows: result.windows.map((window: Record<string, unknown>) => ({
      window_started_at_seconds: window.window_started_at_seconds,
      window_ended_at_seconds: window.window_ended_at_seconds,
      summary: {
        ...window,
        cctv_id: job.cctv_id,
        source_video_identifier: result.source_video_identifier,
        source_video_sha256: result.source_video_sha256,
        detection_artifact_version: source.artifactHash,
        configuration_version: result.configurationVersion,
        analysis_method_version: result.analysis_method_version,
        processed_at: processedAt,
        provenance: result.provenance,
      },
    })) })
    if (completionError) throw new Error('Analysis result could not be published.')
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 240) : 'Analysis failed.'
    try {
      await service.from('cctv_roi_analysis_jobs').update({ status: 'failed', failure_reason: reason, finished_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'processing')
    } catch {
      console.error('ROI analysis failed and its status could not be recorded.')
    }
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  const cors = roiAnalysisCorsHeaders(origin)
  const respond = (body: unknown, status = 200) => response(body, status, cors)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return respond({ error: 'POST required' }, 405)
  if (origin && !cors['Access-Control-Allow-Origin']) return respond({ error: 'Origin not allowed' }, 403)
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in with an authorized CCTV account' }, 401)
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!projectUrl || !anonKey || !serviceKey) return respond({ error: 'Authenticated backend configuration is unavailable' }, 503)

  let cameraId: string
  try {
    const bodyText = await request.text()
    if (new TextEncoder().encode(bodyText).byteLength > 512) return respond({ error: 'Request is too large' }, 413)
    const body = JSON.parse(bodyText)
    cameraId = body?.camera_id
    if (typeof cameraId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cameraId)) return respond({ error: 'Invalid CCTV identifier' }, 400)
  } catch { return respond({ error: 'Invalid request body' }, 400) }

  const userClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: userData, error: authError } = await userClient.auth.getUser()
  if (authError || !userData.user) return respond({ error: 'Sign in with an authorized CCTV account' }, 401)
  const [{ data: saved, error: configError }, { data: media, error: mediaError }] = await Promise.all([
    userClient.from('cctv_analysis_config').select('configuration,configuration_version').eq('cctv_id', cameraId).maybeSingle(),
    userClient.from('cctv_private_config').select('source_kind,source_uri').eq('cctv_id', cameraId).maybeSingle(),
  ])
  if (configError || mediaError) return respond({ error: 'CCTV analysis access could not be verified' }, 403)
  if (!saved) return respond({ error: 'No authorized saved ROI is available' }, 404)
  const config = saved.configuration as Record<string, unknown>
  if (typeof config.source_video_identifier !== 'string') return respond({ error: 'Saved ROI source is invalid' }, 409)
  const source = media?.source_kind === 'stored_clip' ? demos[media.source_uri as keyof typeof demos] : undefined
  if (source && source.id !== config.source_video_identifier) return respond({ error: 'Saved ROI and associated video do not match' }, 409)

  const service = createClient<any>(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  let lookup = service.from('cctv_roi_analysis_jobs').select('*')
    .eq('cctv_id', cameraId).eq('source_video_identifier', config.source_video_identifier)
    .eq('detection_artifact_version', source?.artifactHash ?? 'unavailable')
    .eq('configuration_version', saved.configuration_version).eq('analysis_method_version', algorithm)
  lookup = source ? lookup.eq('source_video_sha256', source.sourceHash) : lookup.is('source_video_sha256', null)
  const { data: existing, error: lookupError } = await lookup.maybeSingle()
  if (lookupError) return respond({ error: 'Analysis job storage is not ready' }, 503)
  let job = existing
  if (!job) {
    const { data, error } = await service.from('cctv_roi_analysis_jobs').insert({
      cctv_id: cameraId, source_video_identifier: config.source_video_identifier,
      source_video_sha256: source?.sourceHash ?? null, detection_artifact_version: source?.artifactHash ?? 'unavailable',
      configuration_version: saved.configuration_version,
      analysis_method_version: algorithm, status: 'pending', created_by: userData.user.id,
      provenance: source ? { record_kind: 'experimental_demo_video', model: source.model } : { record_kind: 'authorized_source_analysis_pending' },
      failure_reason: source ? null : 'No approved cached detection artifact or inference worker is configured for this source.',
    }).select('*').single()
    if (error?.code === '23505') {
      let retry = service.from('cctv_roi_analysis_jobs').select('*').eq('cctv_id', cameraId)
        .eq('source_video_identifier', config.source_video_identifier).eq('detection_artifact_version', source?.artifactHash ?? 'unavailable')
        .eq('configuration_version', saved.configuration_version).eq('analysis_method_version', algorithm)
      retry = source ? retry.eq('source_video_sha256', source.sourceHash) : retry.is('source_video_sha256', null)
      const { data: duplicate } = await retry.maybeSingle()
      job = duplicate
    } else if (error) return respond({ error: 'Analysis job could not be scheduled' }, 503)
    else job = data
    if (!job) return respond({ error: 'Analysis job could not be scheduled' }, 503)
  }
  if (job.status === 'completed' || job.status === 'processing' || job.status === 'superseded') return respond({ job_id: job.id, status: job.status }, 202)
  if (!source) return respond({ job_id: job.id, status: 'pending', reason: job.failure_reason }, 202)
  const { data: claimed, error: claimError } = await service.from('cctv_roi_analysis_jobs').update({ status: 'processing', started_at: new Date().toISOString(), failure_reason: null })
    .eq('id', job.id).in('status', ['pending', 'failed']).select('id').maybeSingle()
  if (claimError) return respond({ job_id: job.id, status: 'pending', reason: 'Analysis could not be scheduled; save the ROI again to retry.' }, 202)
  if (!claimed) return respond({ job_id: job.id, status: 'processing' }, 202)
  EdgeRuntime.waitUntil(processCachedJob(service, job, source, config, saved.configuration_version))
  return respond({ job_id: job.id, status: 'processing' }, 202)
})
