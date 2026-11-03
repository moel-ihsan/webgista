# WebGISTA v2 Deployment Options

Assessment date: 2026-11-03. Free-tier limits change; verify linked provider pages immediately before deployment.

## Summary recommendation

Use **Option B (Vue 3 + TypeScript + Vite + Supabase + MapLibre on Vercel)** for the first WebGISTA v2 academic deployment. It removes the always-on PHP service, keeps metadata/auth/storage in one managed platform, and leaves browser inference on the user's device. It is the better free-tier demonstration architecture, not a universal live-CCTV processing platform.

Keep **Option A** as the fallback when the project needs server-controlled workflows, institutional SSO, complex exports, private-network access, or a paid background worker. Do not select Render's free Postgres for durable research data: its free database expires after 30 days.

## Comparison

| Criterion | Option A — modern Laravel on Render | Option B — serverless Vue/Supabase/Vercel |
|---|---|---|
| v1 compatibility | **High.** Eloquent, controllers, PHP validation, and much of the domain vocabulary migrate naturally. Vue still needs modernization. | **Medium.** UI concepts and PostgreSQL data migrate; controllers/auth/storage are replaced by Supabase APIs and RLS. |
| Migration effort | **Medium.** Upgrade/rebuild Laravel, Vue 3/Vite, policies, schema, Docker, and storage. | **Medium-high.** Rewrite all backend boundaries as schema/functions/RLS and replace auth. Less runtime code remains afterward. |
| Ongoing maintenance | **Medium.** One full application plus database/object storage; framework and PHP patching remain. | **High for a small academic team** once RLS is correct: static frontend plus managed services. Database policies become critical code and need tests. |
| Security model | Laravel middleware, policies, CSRF, validation, signed storage URLs. Familiar and centralized. | Supabase Auth plus PostgreSQL grants/RLS and Storage policies. Strong defense in depth, but one permissive policy can expose data. Service-role keys must never enter the browser. |
| Free availability | Weak: web service sleeps; cold start; 512 MB/0.1 CPU; ephemeral disk; no free worker; Render free DB expires. | Better for demos: static Vercel frontend; Supabase persists but low-activity free projects may pause. Quotas are finite. |
| Video/object storage | Must use external object storage; Render free disk is ephemeral. | Supabase Storage is integrated, but 1 GB free storage and 5 GB egress make raw video expensive quickly. |
| CV processing | Browser TF.js works as in Option B. A paid/background worker can be added more naturally later. Free Render compute is not suitable for continuous CV. | Browser TF.js fits local/short CORS-enabled media. Vercel/Supabase functions are request-oriented, not continuous RTSP/video workers. |
| Live CCTV compatibility | A separate ingest/transcode worker can handle RTSP/private sources, but not within the proposed free web instance. | Direct only when the browser can fetch/decode the source and CORS permits canvas use. Otherwise requires an external gateway/worker. |
| Offline/local research | Docker can package the whole stack locally, but uses more RAM/storage. | Vite frontend plus local Supabase CLI is possible but heavier than hosted Supabase. A static fixture mode can keep low-RAM work practical. |
| Vendor coupling | Moderate: Laravel/PostgreSQL are portable; Render config is replaceable. | Moderate: PostgreSQL is portable, but Auth, Storage, RLS helpers, and Realtime use Supabase conventions. MapLibre avoids map-renderer lock-in. |

## Option A — Modernized Laravel

### Proposed shape

- Laravel 13 on PHP 8.3+ with a small JSON API and server-rendered health endpoint.
- Vue 3 + TypeScript + Vite frontend, built in a multi-stage Docker image.
- PostgreSQL with PostGIS. For a free academic demo, use an external durable free database only after accepting its limits; do not rely on expiring Render Free Postgres.
- S3-compatible object storage or Supabase Storage for images/videos.
- Render Docker web service. Keep inference in the browser for the baseline.

Laravel 13 is the current supported major and requires PHP 8.3; security support runs through 2028-03-17 ([Laravel release policy](https://laravel.com/framework/docs/13.x/releases)). Pin exact container/runtime versions and update them through CI.

### Free-tier reality

Render's free web service has 512 MB RAM and 0.1 CPU, sleeps after 15 idle minutes, can take about a minute to wake, and loses local filesystem changes on restart/redeploy/spin-down. It cannot attach a free persistent disk or scale beyond one instance. Render grants 750 free instance-hours per workspace/month. Its free Postgres is 1 GB, has no backups/pooling, and expires after 30 days ([Render free services](https://render.com/docs/free), [compute plans](https://render.com/docs/compute-plans)).

Consequences:

- Good for an intermittent portfolio/demo API after accepting cold starts.
- Bad for durable uploads, always-on jobs, continuous stream ingest, or server-side model inference.
- A queue worker is not available on the free plan. Running queue work inside the web process would make reliability worse and should not be done.
- Docker build layers and Composer/npm installs must fit build limits; the final image should contain production PHP dependencies and built static assets only.

### Minimum production controls

- Non-root container, health endpoint, trusted proxy/HTTPS configuration, `APP_DEBUG=false`, immutable image.
- `auth` plus policies on all mutations; rate limits on login, uploads, and observation writes.
- Managed database migrations as a release step with backup/rollback plan.
- External object storage; no uploaded file on Render's local filesystem.
- One current lockfile for Composer and npm; `composer audit` and `npm audit` in CI.
- No CV worker claim until measured on a paid worker or separate research machine.

## Option B — Serverless Vue/Supabase/Vercel

### Proposed shape

- Vue 3, TypeScript, Vite, and generated Supabase database types.
- Supabase PostgreSQL + PostGIS, Auth, Storage, and optionally Realtime.
- MapLibre GL JS with a separately selected tile/style provider.
- TensorFlow.js loaded only in the detection route.
- Vercel static deployment. Use functions only for a narrow secret-bearing operation if no database-native safe alternative exists.

MapLibre is an open-source TypeScript/WebGL map renderer; tiles/styles are a separate operational dependency ([MapLibre GL JS docs](https://maplibre.org/maplibre-gl-js/docs/)). Supabase's public-schema tables must have grants and RLS designed together; the service-role key bypasses RLS and stays server-side ([Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)). Storage uploads likewise require explicit policies ([Storage access control](https://supabase.com/docs/guides/storage/security/access-control)).

### Free-tier reality

As of the audit date, Supabase Free includes two projects, 500 MB database per project, 1 GB object storage, 5 GB egress, 50,000 monthly active users, and 500,000 Edge Function invocations ([Supabase billing/quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)). Low-activity free projects can pause after roughly a week and can be restored ([project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).

Vercel Hobby is for personal/non-commercial projects. Its documented included usage and function limits are adequate for a static academic frontend, but functions are bounded request handlers—not video workers ([Hobby plan](https://vercel.com/docs/plans/hobby), [limits](https://vercel.com/docs/limits)).

Consequences:

- Metadata and small snapshots fit more easily than raw video. At 1 GB, even a handful of long clips can exhaust storage.
- Default workflow should process a local user-selected video without uploading it. Upload only short, consented research clips that need reproducibility, with explicit retention/deletion rules.
- Use public read policies only for safe map fields. Keep private stream URLs, credentials, original videos, and admin metadata private.
- RLS migration tests are mandatory. A frontend role check is never authorization.

## CCTV and browser constraints

COCO-SSD accepts browser image/video/canvas input and returns class, score, and bounding box; its default score threshold is 0.5 ([COCO-SSD documentation](https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/README.md?plain=1)). This does not mean every CCTV URL is usable.

A browser can process a source only when all are true:

1. The browser supports the protocol/container/codec (normally HTTPS MP4 or browser-supported HLS; not raw RTSP).
2. The stream is reachable from the user's network.
3. The source permits the application's origin with CORS and the video uses the correct `crossorigin` mode.
4. Authentication can be supplied without exposing durable camera credentials.
5. Device CPU/GPU/memory can sustain the selected frame size and sampling rate.

Drawing a cross-origin video without CORS approval taints the canvas and prevents pixel access/export ([MDN canvas/CORS](https://developer.mozilla.org/en-US/docs/Web/HTML/How_to/CORS_enabled_image)). TensorFlow.js performance and numeric behavior vary by device/backend; WebGL work also needs explicit memory care and can affect the UI thread ([TensorFlow.js platform guide](https://www.tensorflow.org/js/guide/platform_environment)).

Therefore:

- Baseline v2 supports local files and a tested allowlist of CORS-enabled HTTPS sources.
- The UI must report `unsupported protocol`, `CORS blocked`, `decode failed`, and `device too slow` distinctly.
- Private RTSP/vendor streams require an optional ingest/transcode service deployed on an authorized network. That service is outside both free-tier baselines.

## Decision

Choose Option B for v2 because WebGISTA's first release is a low-traffic academic map and browser experiment, not a general stream-processing platform. It yields the smallest maintained backend and the best free-tier durability of the two named choices.

Choose Option A instead if a requirement appears for server-mediated camera credentials, institutional integration, scheduled reports, or a paid persistent worker. The database and observation schema in `ARCHITECTURE_V2.md` works with either option.

