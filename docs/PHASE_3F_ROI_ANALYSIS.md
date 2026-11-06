# Phase 3F — ROI analysis execution

## Implemented

- Saving an ROI can invoke the authenticated `process-roi-analysis` Edge Function when `VITE_SUPABASE_ROI_ANALYSIS_ENABLED=true`. The function creates/claims a durable job, returns immediately, and uses Supabase `EdgeRuntime.waitUntil` for the bounded cached reaggregation. The feature flag defaults to false.
- The function uses the caller JWT to read the camera ROI and private video association under existing RLS. It accepts no artifact URL or source URL from the caller.
- The two approved Pexels demos use detection JSON artifacts pinned to SHA-256 values. The function reaggregates those cached YOLOX-S detections into the existing 10-second ROI presence windows; it does not run YOLOX, tracking, or inference.
- Jobs and compact window summaries are stored in new private tables. Authenticated users can read results only for CCTV their agency can manage. Only the backend service role can write jobs or publish results.
- ROI or source-video changes supersede prior jobs. Publication locks the current configuration and rejects results for an old configuration version.
- Permanent CCTV deletion removes its analysis jobs and per-window result summaries through the reviewed cascade chain; manual `traffic_observations` remain `ON DELETE RESTRICT`. The deployment preflight now checks both new foreign-key actions explicitly.
- These experimental demo results do not write `traffic_observations`, manual conditions, or map-marker state. MKJI V/C remains No Data without validated flow and camera-specific capacity.
- A source without an allowlisted cached artifact receives an honest Pending job; no continuous worker or new-source inference is configured. The Edge background task is bounded by platform limits, not an always-on worker. Saving again creates a new ROI version and retries through a new job if a previous task failed.

## Deployment boundary

Migration `20261106000200_cctv_roi_analysis_results.sql` is migration 011. It is guarded by SHA-256 `00b9c031eafd4c7dce5f94930c20fb3285df3bbb1a0955c1ddeb5f4c4217add6`. It is included in disposable CI and the development migration guard, but is not authorized for hosted apply. The protected deployment workflow explicitly blocks its apply until separate authorization.

The Edge Function and production ROI analysis flag have not been deployed/enabled. Keep `VITE_SUPABASE_ROI_ANALYSIS_ENABLED` false until migration 011 is approved and applied, the function is deployed, and the backend execution path is verified on hosted development. The function needs Supabase's server-side service-role environment variable; it must never be copied into a `VITE_*` setting.

Cached JSON artifacts are publicly served as fixed demo inputs from the existing Vercel project. Their source-video SHA, artifact SHA, identifier, and schema are checked before processing. Local Node tests process each cached artifact in roughly 0.16–0.37 seconds, but this is not a hosted Edge CPU measurement. Supabase documents a 2-second CPU budget per request on the Free plan; hosted runtime profiling is still required. A new camera source needs a separately operated authorized Python worker; Vercel and Edge Functions do not run YOLOX inference.

## Verification

Node tests compare reaggregated demo windows with the checked-in Python outputs, reject source mismatch and invalid boxes, and verify partial-window and No Data semantics. Disposable pgTAP coverage checks RLS, admin/editor boundaries, anonymous denial, backend-only publication, idempotency constraints, config/source invalidation, transaction rollback, and separation from manual observations.

Hosted migration, Edge deployment, Realtime/polling on a deployed backend, and authenticated Chrome acceptance remain pending. This implementation does not claim live analysis.
