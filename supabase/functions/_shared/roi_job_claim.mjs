const maxEdgeRuntimeMs = 150_000
const staleJobGraceMs = 30_000

export async function claimRoiAnalysisJob(service, jobId, now = Date.now()) {
  const startedAt = new Date(now).toISOString()
  const claim = (filter) => filter(service.from('cctv_roi_analysis_jobs')
    .update({ status: 'processing', started_at: startedAt, failure_reason: null, finished_at: null }))
    .eq('id', jobId).select('id').maybeSingle()

  const fresh = await claim(query => query.in('status', ['pending', 'failed']))
  if (fresh.error) throw new Error('Analysis job could not be claimed.')
  if (fresh.data) return { startedAt }

  // Edge Functions have a 150-second wall-clock limit on Free; the grace avoids reclaiming a live worker.
  const staleBefore = new Date(now - maxEdgeRuntimeMs - staleJobGraceMs).toISOString()
  const stale = await claim(query => query.eq('status', 'processing').lt('started_at', staleBefore))
  if (stale.error) throw new Error('Analysis job recovery could not be claimed.')
  return stale.data ? { startedAt } : null
}
