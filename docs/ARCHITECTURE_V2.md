# WebGISTA v2 Architecture

## Recommended architecture

Build v2 as a separate Vue 3 + TypeScript + Vite application deployed to Vercel, backed by Supabase PostgreSQL/PostGIS, Auth, and Storage. Use MapLibre GL JS for mapping and TensorFlow.js for bounded browser inference. Preserve v1 unchanged as a tagged research artifact and migrate data into a new database.

This architecture targets an academic demo and reproducible experiments under free-tier limits. It does not promise continuous processing of arbitrary live CCTV feeds.

```text
Public viewer / authenticated operator
                |
                v
       Vue 3 static application
       | map/query        | local/CORS video
       v                  v
Supabase API + RLS   Browser CV pipeline
       |                  |
       v                  | validated window result
PostgreSQL/PostGIS <------+
       |
       +--> private/public Storage (snapshots, optional short research clips)

Optional later, paid/authorized network only:
RTSP/private camera -> ingest/transcode + CV worker -> validated observation API
```

## Modules

Keep modules aligned with user jobs. Do not add a generic service/repository layer.

| Module | Responsibility |
|---|---|
| `auth` | Sign in/out, session, current profile/role. Supabase Auth owns credentials. |
| `map` | Render safe CCTV projection, condition layer, Banda Aceh boundary, search/filter, map settings. |
| `cctv` | Authorized CCTV, agency, snapshot, stream capability, and ROI calibration management. |
| `detection` | Source validation, model load, frame sampling, class mapping, tracking/counting, run state, result submission. |
| `traffic` | Versioned traffic formula, observation validation, latest status, history queries. |
| `dashboard` | Aggregates persisted observations only. No hardcoded metrics. |
| `admin` | Users/roles, agencies, settings, retention, and audit view. |
| `shared` | Supabase client, generated DB types, small UI primitives, errors. No global domain dumping ground. |

Pinia is not required initially. Supabase query state stays in page/module composables; detection session state stays local to the detection page. Add a store only when state genuinely spans routes.

## Database schema

Use UUID primary keys, `timestamptz` in UTC, `created_at`/`updated_at`, explicit constraints, and PostGIS `geography(Point,4326)`. Preserve original source IDs in nullable `legacy_id` columns for traceability.

### `profiles`

| Column | Type / rule |
|---|---|
| `user_id` | UUID PK/FK to `auth.users`, cascade delete |
| `display_name` | text, required, bounded length |
| `avatar_path` | text nullable |
| `created_at`, `updated_at` | timestamptz |

No authorization role is user-editable here.

### `user_roles`

| Column | Type / rule |
|---|---|
| `user_id` | UUID PK/FK to `auth.users` |
| `role` | text check in `admin`, `operator`, `viewer` |
| `granted_by`, `granted_at` | UUID/timestamptz |

Only trusted admin logic can change roles. A stable `is_admin()`/`can_operate()` SQL function may read this table for RLS; ordinary users cannot write it.

### `agencies`

| Column | Type / rule |
|---|---|
| `id` | UUID PK |
| `legacy_id` | bigint nullable unique |
| `name` | text required, case-insensitive unique |
| `created_at`, `updated_at` | timestamptz |

### `cctv_locations`

| Column | Type / rule |
|---|---|
| `id` | UUID PK |
| `legacy_id` | bigint nullable unique |
| `agency_id` | UUID FK to `agencies`, restrict delete |
| `name`, `address` | bounded text, required |
| `category` | text check `regular` or `analytic` |
| `location` | `geography(Point,4326)`, required; valid longitude/latitude |
| `snapshot_path` | text nullable |
| `public_stream_url` | text nullable; HTTPS/allowlist validation |
| `private_source_ref` | text nullable, never exposed to public clients; preferably a secret reference, not credentials |
| `roi_polygon` | jsonb nullable; normalized points in 0..1 plus validation constraint/function |
| `calibration_width`, `calibration_height` | positive integer nullable; records reference frame |
| `is_active` | boolean default true |
| `created_by`, `updated_by` | UUID FK to auth user |
| timestamps | timestamptz |

Expose a view/RPC such as `public_cctv_map` containing only ID, name, agency name, location, category, snapshot URL, safe playable URL if public, latest condition, and observation time. Do not expose private source references.

### `detection_runs`

| Column | Type / rule |
|---|---|
| `id` | UUID PK generated before processing; submission idempotency key |
| `cctv_id` | UUID FK nullable for ad-hoc/local research |
| `created_by` | UUID FK, required |
| `source_kind` | check `local_file`, `public_stream`, `stored_clip`, `worker` |
| `source_path` | private storage path nullable; never a local user filename alone |
| `status` | check `created`, `running`, `completed`, `failed`, `cancelled` |
| `model_name`, `model_version` | required |
| `backend`, `device_summary` | bounded text/jsonb with non-sensitive capability data |
| `confidence_threshold`, `sample_fps` | constrained numeric |
| `counting_method` | check `frame_detections`, `tracked_line_crossings`, `manual` |
| `class_mapping_version`, `formula_version` | required for completed runs |
| `started_at`, `completed_at`, `error_code` | timestamptz/text nullable |

### `traffic_observations`

One row is one defined time window, not one animation frame.

| Column | Type / rule |
|---|---|
| `id` | UUID PK |
| `run_id` | UUID FK to `detection_runs` |
| `cctv_id` | UUID FK required |
| `window_started_at`, `window_ended_at` | timestamptz; end > start |
| `light_vehicle_count` | non-negative integer |
| `heavy_vehicle_count` | non-negative integer |
| `motorcycle_count` | non-negative integer |
| `bicycle_count` | non-negative integer default 0; keep separate if research requires it |
| `sampled_frames` | positive integer |
| `condition_score` | numeric nullable |
| `condition_band` | checked vocabulary such as `great`..`terrible` |
| `quality_flags` | text array/jsonb for occlusion, dropped frames, uncalibrated ROI, etc. |
| `created_at` | timestamptz |

Unique `(run_id, window_started_at)` makes retries idempotent. Index `(cctv_id, window_ended_at desc)` for map/latest queries and `window_ended_at` for dashboard ranges.

### `map_config`

A single constrained row: center point, zoom range, default style identifier, updated-by/timestamp. Use an explicit singleton key; do not create an open-ended key/value settings table.

### `admin_audit_events`

Append-only records for role, CCTV, agency, settings, and retention changes: actor, action, entity type/id, timestamp, and bounded before/after JSON. Never store passwords, tokens, or full private stream credentials.

### Removed v1 structures

- `totalvehs`: dashboard aggregates query `traffic_observations`.
- Agency text on CCTV: replaced by `agency_id`.
- Current `keterangan` as manually overwritten source of truth: latest condition is derived from the newest valid observation. An optional cached value must be database-maintained and auditable.
- Jetstream teams/API tables unless a real multi-organization requirement appears.

## Computer-vision design

### Class mapping

Start with an explicit versioned map:

- light vehicle: COCO `car`
- heavy vehicle: `bus`, `truck`
- motorcycle: `motorcycle`
- bicycle: separate or excluded according to the thesis
- person and all other COCO classes: excluded

The detector returns class, score, and bounding box; use and persist an explicit score threshold instead of relying invisibly on the model default ([COCO-SSD API](https://github.com/tensorflow/tfjs-models/blob/master/coco-ssd/README.md?plain=1)).

### Counting modes

1. **Frame detections:** count boxes in one sampled frame. Useful for debugging/occupancy research. Never label it unique vehicles.
2. **Tracked line crossings:** associate detections between frames, maintain short-lived track IDs, and count an ID once when its centroid crosses a calibrated direction line. This is the v2 target for unique flow counts.
3. **Manual ground truth:** operator-entered reference counts for evaluation.

Use a small established tracker only after evaluating its bundle/maintenance cost; a minimal centroid/IoU tracker may be enough for fixed cameras but must be benchmarked against annotated clips. Record dropped tracks and occlusion limitations. Do not claim accuracy or frame rate without a named dataset, device/browser, resolution, sampling rate, and metric.

### Browser pipeline

1. User selects local file or a capability-checked public source.
2. Validate protocol, decode, CORS/pixel access, dimensions, duration, and device backend.
3. Load model lazily; perform a warm-up frame.
4. Sample using `requestVideoFrameCallback` when available, with a timer fallback and at most one inference in flight.
5. Downscale to a configured inference resolution; map boxes back to source coordinates.
6. Apply normalized ROI, confidence threshold, class map, and tracker.
7. Close fixed observation windows and show provisional counts locally.
8. Authenticated operator confirms/submits; database validates run ownership, ranges, and idempotency.
9. Dashboard and map read only persisted completed observations.

Use a Web Worker/OffscreenCanvas only after profiling shows main-thread blocking and browser support is acceptable. TensorFlow.js backends vary across devices; benchmark WebGL and WASM rather than promise one is always faster ([TensorFlow.js platform guide](https://www.tensorflow.org/js/guide/platform_environment)).

### Live cameras

Supported in the base release only when the browser can fetch/decode the source and CORS allows canvas pixels. Raw RTSP, private camera credentials, vendor plugins, and sources requiring IP allowlists need an optional authorized ingest service. That later service should normalize streams, isolate secrets, enforce per-camera rate limits, and submit the same `detection_runs`/`traffic_observations` contract. It is not part of the free Vercel/Supabase deployment.

## Traffic formula and research reproducibility

Do not silently copy `0.13`, `0.1`, `0.04`, `4455`, or the v1 thresholds. First recover their units and source from the thesis. Implement a pure versioned function with:

- named parameters and units;
- a defined count window and direction/lane scope;
- worked-example tests from the research method;
- formula version stored on every run;
- quality flags when calibration or sampling requirements are unmet.

Keep raw class counts even if the condition formula changes. This permits later recalculation without rerunning inference.

## Security boundaries

### Public browser

- May read only the public CCTV map projection and aggregated observations approved for publication.
- Receives a Supabase anon key; this is a public identifier protected by grants/RLS, not a secret.
- Never receives service-role keys, database passwords, private camera credentials, or unrestricted signed URLs.

### Authenticated operator

- Can create detection runs and submit observations only for allowed active CCTV locations.
- Can manage CCTV/agency data only if role policy allows it.
- Storage policy restricts uploads by bucket, owner/path, MIME type, and size. Server/database validation repeats client validation.

### Administrator

- Can grant roles and manage configuration through narrowly scoped protected operations.
- Sensitive changes append an audit event.
- No user can promote their own `profiles` row into an admin role.

### Database/Storage

- Revoke broad default grants; grant only required operations and add a separate RLS policy for select/insert/update/delete.
- Test allow and deny cases for anonymous, viewer, operator, admin, and wrong owner.
- Private buckets hold original clips; public bucket contains only deliberate snapshots/derived public assets.
- Use short-lived signed URLs and explicit retention. Avoid storing third-party camera credentials at all when possible.

Supabase recommends enabling RLS on every exposed table and testing both grants and policies ([RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)).

## Dashboard semantics

Every metric must state its source and interval:

- active CCTV count: `cctv_locations where is_active`
- latest condition distribution: latest completed observation per CCTV within a freshness threshold
- vehicle totals: sum of persisted observation windows, filtered by date/camera/counting method
- trend chart: time-bucketed counts with timezone shown to the user
- data freshness: newest observation timestamp and number of stale/offline cameras

Never mix frame detections with tracked unique counts in one total. Filter or group by `counting_method` and formula/model version.

## Deployment and resource controls

- Vercel hosts the static build. No continuous function.
- Supabase hosts Postgres/Auth/Storage; PostGIS enabled through a migration.
- MapLibre renderer plus a documented tile/style provider. If Mapbox remains the provider, use a dedicated public URL-restricted token; public tokens are expected in web apps, but private scopes are not ([Mapbox token guidance](https://docs.mapbox.com/accounts/guides/tokens/)).
- Lazy-load map and ML routes. Do not bundle TensorFlow twice.
- Do not upload local videos by default; this protects privacy and the 1 GB/5 GB free quotas.
- CI runs formatting/typecheck/unit tests, RLS database tests, build, dependency audits, and migration checks.

## Architecture decision record

**Decision:** Option B for v2 baseline.

**Reason:** smallest maintained backend, durable managed metadata/storage compared with Render's expiring/ephemeral free resources, and good fit for low-traffic academic use.

**Accepted limits:** Supabase pause/quotas, RLS learning cost, browser-dependent inference, no arbitrary live CCTV support.

**Revisit when:** continuous cameras, private network sources, institutional auth, or reliable scheduled processing becomes mandatory. At that point add a paid worker/gateway or select Option A without changing the observation contract.

