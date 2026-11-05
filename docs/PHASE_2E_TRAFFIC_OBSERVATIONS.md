# Phase 2E — Traffic Observations

## V1 behavior verified from source

- `resources/js/app.js:115-118` loads TensorFlow.js and COCO-SSD in the browser.
- `resources/js/components/C_Videodetail.vue:308-332` waits for the video and calls `model.detect()` during `timeupdate` events.
- `C_Videodetail.vue:333-356` groups truck/bus, car, person/motorcycle/bicycle detections. The `else if (cars)` check uses the non-empty string `"car"`, so every remaining class is counted as a car. The person-to-motorcycle grouping is also not a vehicle-only count.
- `C_Videodetail.vue:319-330` resets counts for every frame. These are per-frame detections, not unique vehicles over a time interval.
- `C_Videodetail.vue:360-410` applies the weighted threshold formula to these frame counts and posts only the resulting `keterangan` to the camera record. `C_Map.vue:419,536` reads that value for map display. V1 does not preserve observation history, model provenance, or a frame sampling window.
- V1 has six condition labels and a blue `No Data` legend in `resources/js/components/C_Map.vue:120-127`.

The v2 implementation does not carry over the buggy per-frame condition thresholds. Its Phase 2A schema already models observation windows, source, method, model provenance, and vehicle counts. The database lacked only the condition field.

## V2 implementation

- Migration `20261105000100_traffic_observation_conditions.sql` adds an enum condition and nullable column. Existing rows remain valid and null means no condition.
- `latest_traffic_observations` is a `security_invoker` view over completed observations. It has SELECT granted only to `authenticated`; base-table RLS remains authoritative. No anonymous observation grant or policy is added.
- Existing agency-scoped INSERT/SELECT/UPDATE policies and admin DELETE policy are unchanged. The added condition column privilege is still constrained by those row policies. Editors cannot insert observations for cameras outside their authorized agencies.
- `/analysis` now shows authorized CCTV, the latest completed observation and history. It can write an explicitly manual five-minute assessment (`source_kind=manual`, `counting_method=manual`). The UI distinguishes manual from processed records. RLS remains the security boundary.
- Dashboard and full Map View use the latest authorized condition when available. Map markers use the original V1 condition palette. Private/anonymous map sessions receive no observation records and display No Data.
- No Data is represented by no observation or a null condition; it is not stored as a fabricated observation.

## Verification state

- Frontend `npm run verify`: passed (135 tests across 27 files, TypeScript, ESLint, production build).
- Database security suite `phase_2e_observations.test.sql`: 25 assertions planned; not executed locally because Supabase CLI, Docker and PostgreSQL test tools are unavailable.
- Combined planned CI total: 200 assertions (existing 175 plus 25). This is a plan, not a passing result. The CI workflow now invokes the new suite.
- No hosted migration was applied. Migration 005 needs isolated CI and then the existing protected development deployment/authorization process. The currently observed remote deployment workflow must be reviewed before any hosted apply.
- No manual observations have been inserted into hosted Supabase.

## Limitations

Manual condition ratings are user-entered and are not a calibrated traffic estimate. No automatic condition formula is used. Existing v1 data that only contains `cctv_locations.keterangan` is not converted because its time window and provenance cannot be recovered reliably.
