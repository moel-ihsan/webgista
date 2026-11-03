# WebGISTA v2 Migration Plan

## Principles

- Preserve v1 source and data. V2 is a new application and new database.
- Security and measurement semantics precede UI polish.
- Migrate in thin, demonstrable slices; do not port dead scaffolding.
- Keep raw counts and provenance so research results can be reproduced.
- Fit limited development hardware: one frontend dev server, hosted Supabase where possible, lazy ML loading, small fixtures, no local video corpus in Git.

## Priority roadmap

### Phase 0 — Preserve and record v1 (P0)

1. Create an immutable `v1-research` tag at the audited commit and protect it. Do this only after the owner confirms repository policy.
2. Export the original database read-only, export public uploads, and record checksums in secure offline storage. Do not commit exports or secrets.
3. Record current PHP/Node/Composer/npm versions and the audit documents.
4. Rotate the seeded admin credentials and the repeated Mapbox token on any existing deployment. Restrict the replacement public map token by allowed URL.
5. Disable public access to v1 or place it behind access control until P0 issues are removed. Prefer a read-only archival deployment.

**Exit gate:** v1 revision, database, and media can be restored independently; no known default credential remains active.

### Phase 1 — Define research behavior (P0/P1)

1. Recover the thesis definitions for LV/HV/MC, weights, capacity, thresholds, time window, lanes/directions, and expected output.
2. Decide whether v2 reports frame occupancy, unique line crossings, or both. Give them separate names and storage semantics.
3. Build a tiny consented validation set: a few short clips, manual class/count annotations, camera resolution, and expected line crossings. Keep large/private files outside Git; commit only metadata and small permitted fixtures.
4. Write pure tests for class mapping and worked traffic-formula examples.
5. Define minimum supported sources: local video first, then named HTTPS MP4/HLS sources verified for codec and CORS. Explicitly mark RTSP/private sources unsupported in the baseline.

**Exit gate:** a reviewer can explain every stored metric, its unit, and how the same result is reproduced.

### Phase 2 — Bootstrap v2 separately (P1)

1. Create a new `v2` branch or sibling directory without changing v1 files. Prefer a clean Vite Vue 3 TypeScript application rather than upgrading the old generated bundle in place.
2. Add only required dependencies: Vue, router, Supabase client, MapLibre, TensorFlow.js/COCO-SSD. Add a UI library only if native controls plus small components are insufficient.
3. Configure environment validation for public Supabase URL/anon key, map style/tile URL, and optional public map token. Add `.env.example` with no secrets.
4. Add CI for install, typecheck, unit tests, production build, dependency audit, and secret scan.
5. Establish an explicit browser support matrix and a low-memory fixture mode.

**Exit gate:** a fresh clone builds reproducibly and renders a static shell; CI is green.

### Phase 3 — Schema, Auth, and RLS foundation (P0)

1. Create migrations for PostGIS, `profiles`, `user_roles`, `agencies`, `cctv_locations`, `detection_runs`, `traffic_observations`, `map_config`, and `admin_audit_events` as defined in `ARCHITECTURE_V2.md`.
2. Revoke broad grants and enable RLS on every exposed table. Add separate policies per operation.
3. Add RLS tests for anonymous/viewer/operator/admin, including negative tests for self-promotion, wrong-owner updates, private stream fields, and storage paths.
4. Configure Supabase Auth. Use invite/admin provisioning for the initial academic deployment unless public registration is a real requirement.
5. Configure public snapshot and private clip buckets with MIME/size/path policies. Never expose the service-role key to Vue.

**Exit gate:** all deny/allow policy tests pass; anonymous clients cannot mutate data or read private fields.

### Phase 4 — Read-only map slice (P1)

1. Import agencies, CCTV metadata, map settings, and snapshots into a staging v2 database using a repeatable script.
2. Correct `lattitude` during transformation, parse numeric coordinates, reject/outfile invalid rows, and preserve `legacy_id`.
3. Document and import the Banda Aceh GeoJSON source, license, CRS, and checksum.
4. Implement the MapLibre map, clustering, boundary layer, search, safe DOM popups, condition legend, and freshness indicator using only the public projection.
5. Add tests for coordinate order, invalid coordinates, safe popup rendering, empty settings, and no observations.

**Exit gate:** v2 displays the same legitimate CCTV locations without exposing private URLs or requiring an admin session.

### Phase 5 — Administrative CRUD and media (P0/P1)

1. Implement authorized agency and CCTV create/edit/deactivate flows. Prefer deactivate over immediate delete when observations exist.
2. Validate names, coordinate bounds, category, URL scheme/allowlist, snapshot MIME/dimensions/size, and ROI shape at the database/trust boundary.
3. Upload with unique object paths in one user action. Store metadata only after upload succeeds; on failure, roll back/clean the new object. Replace old objects only after the new reference is committed.
4. Add map-config editing with an explicit Save action.
5. Append audit events for role/config/CCTV/agency changes.

**Exit gate:** operators can manage allowed records; anonymous/viewer requests fail; concurrent uploads cannot collide.

### Phase 6 — Detection prototype with honest semantics (P1)

1. Implement local-file playback, source capability checks, lazy model load, one-inference-at-a-time backpressure, and configurable sampling.
2. Implement explicit COCO class mapping and confidence threshold. Show score/box debug overlay.
3. Implement normalized ROI calibration and persist its reference resolution.
4. First ship `frame_detections` as a clearly named research/debug mode if it passes fixtures.
5. Add tracked line-crossing mode. Evaluate against manual annotations; report precision/recall/count error without unsupported generalization.
6. Save run provenance and completed observation windows idempotently. Never write a condition on every frame.
7. Detect and report CORS, decode, model-load, GPU/backend, and slow-device failures separately.

**Exit gate:** annotated fixture results are reproducible; the UI never calls frame detections unique vehicles.

### Phase 7 — Formula, map status, and dashboard (P1)

1. Implement the validated versioned traffic formula as a pure function/database-safe calculation.
2. Calculate conditions from completed windows and expose latest condition with timestamp/freshness.
3. Refresh map conditions by ID at a bounded rate; use Realtime only if it reduces complexity/load and works within quota.
4. Build cards/charts only from persisted observations. Always display date range, timezone, counting method, model/formula version filters, and stale-data state.
5. Add export of aggregate CSV with provenance; do not export private source URLs.

**Exit gate:** every dashboard number links to its filter/window and can be recomputed from database rows.

### Phase 8 — Deployment and operational verification (P0/P1)

1. Create separate Supabase development and production projects if free project limits permit; otherwise keep local migrations/tests and one hosted production project.
2. Deploy static v2 to Vercel Hobby only while use remains personal/non-commercial academic work.
3. Configure production domains, HTTPS, CSP, Supabase redirect allowlist, storage CORS, RLS, environment values, and map-token URL restrictions.
4. Run a restore rehearsal from logical database export and storage manifest. Free tiers are not a backup strategy.
5. Measure frontend bundle/routes, first map load, model download, memory, inference latency, and observation error on at least one low-end and one typical device. Report the actual devices and conditions.
6. Add uptime/usage checks that respect free-tier rules; do not create fake traffic to evade provider pausing.

**Exit gate:** production smoke tests pass, restoration is documented, and quota/unsupported-source warnings are visible.

### Phase 9 — Optional live-camera worker (P2, only with requirement and budget)

1. Inventory actual camera protocols, codecs, authentication, licensing, privacy, and network reachability.
2. Prototype one authorized camera through a separate gateway/worker. Keep credentials in the worker secret store.
3. Normalize frames/streams, bound reconnects and resource use, and submit the same run/observation contract.
4. Benchmark CPU/GPU, bandwidth, reliability, and cost before claiming multi-camera capacity.
5. Deploy only on infrastructure suitable for continuous work; neither Vercel functions nor Render's free web service is that infrastructure.

**Exit gate:** one camera runs for a defined soak period with measured resource/cost/error data and an operator shutdown path.

## Data migration rules

- Read v1; write v2. Never update the source database.
- Map `cctv_points.id -> cctv_locations.legacy_id` and `agency` strings to normalized agency IDs.
- Parse longitude first and latitude second; require longitude `[-180,180]`, latitude `[-90,90]` and optionally a Banda Aceh study-area check.
- Convert empty/`"null"` URLs to SQL null. Accept only reviewed HTTP(S) URLs; quarantine others.
- Copy snapshot bytes to unique object paths, verify checksum/MIME, then write the v2 reference.
- Import `keterangan` only as legacy metadata if needed, not as a trustworthy observation. Do not invent historical timestamps/counts.
- Do not migrate `totalvehs` unless real populated rows and their semantics can be established; no relationship exists in source.
- Produce a reconciliation report: source rows, imported rows, quarantined rows with reason, media successes/failures, and checksums.

## Minimum test set

1. Anonymous cannot insert/update/delete any protected row or upload private media.
2. Viewer cannot perform operator/admin actions; operator cannot grant roles; admin can.
3. Public map view omits private source references and credentials.
4. Coordinate/ROI/url/upload validation accepts boundary-valid cases and rejects invalid cases.
5. COCO class mapping never counts person/bicycle as motorcycle or arbitrary classes as car.
6. A track is counted once on the configured line crossing, including occlusion/re-entry fixtures.
7. Traffic formula matches thesis worked examples and stores its version.
8. Duplicate observation submission is idempotent.
9. Empty database/map config and no-observation states render safely.
10. Migration reconciliation matches expected counts and does not modify v1.

## Work deliberately deferred

- Continuous multi-camera processing, RTSP gateway, custom-trained model, GPU worker, notifications, multi-tenancy, and advanced analytics are not in the free v2 baseline.
- Do not port Jetstream teams, API tokens, `totalvehs`, fixed chart data, or both v1 auth systems.
- Do not promise detection accuracy, real-time frame rate, or camera capacity until measured under named conditions.

## Ordered implementation roadmap

1. Preserve/secure v1.
2. Define and test research semantics.
3. Bootstrap separate v2 and CI.
4. Build schema/Auth/RLS.
5. Migrate and render read-only map.
6. Add authorized CRUD/storage.
7. Build and validate browser detection.
8. Persist observations and implement dashboard.
9. Deploy, restore-test, and benchmark.
10. Add a paid live-camera worker only if actual sources require it.

