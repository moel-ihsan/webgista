# Phase 2D.4 and 2D.5 Final Acceptance

**Status: PHASE 2D — IMPLEMENTED, ACCEPTANCE BLOCKED**

This report separates disposable CI, read-only hosted verification, and hosted operations. No migration or application data was changed in the hosted project during this run.

## Completion matrix

| Stage | Status | Evidence |
|---|---|---|
| 1. Isolated database CI | VERIFIED | Run [41901319126](https://github.com/moel-ihsan/webgista/actions/runs/41901319126), commit `724adcc65c06dd4be04e1228b2180bc046a28b20`; six migrations, read-only schema preflight, database lint, pgTAP 119 + 36 + 20 = **175/175**, fixture validation, cleanup, and migration-guard tests passed. |
| 2. Promote to development branch | VERIFIED | Fast-forward commits promoted from isolated worktree. The migration/deployment snapshot is `beb3aec45c2fd0b56933d09ee2d18e825f5bb0d8`; this report is at `39caa29`. Main worktree was not changed. |
| 3. Hosted read-only preflight | VERIFIED | Preview run [41901846111](https://github.com/moel-ihsan/webgista/actions/runs/41901846111) passed target, hash, migration history, schema preflight, and exact dry-run checks. `verify` run [41901997001](https://github.com/moel-ihsan/webgista/actions/runs/41901997001) also passed. Both reported only 003 and 004 pending. |
| 4. Hosted migrations | BLOCKED | Apply was attempted only through the protected workflow and stopped at the required recovery gate. Backup API returned HTTP 403; no completed backup or verified manual restore is available. Migration apply was skipped. |
| 5. Hosted Storage and role-scoped authorization | BLOCKED | Migrations are not installed; no authorized profile-photo/CCTV-image QA identities or agency-editor session are available. |
| 6. Development feature flags | DEFERRED | `VITE_SUPABASE_PROFILE_FIELDS_ENABLED` and `VITE_SUPABASE_PRIVATE_MEDIA_ENABLED` remain disabled; agency removal remains disabled. |
| 7. Frontend/browser acceptance | BLOCKED | Local `npm run verify` passed (TypeScript, ESLint, 118 Vitest tests in 23 files, production build). No authenticated browser session was available for profile-media acceptance. |
| 8. Documentation and final report | VERIFIED | This document records actual results and remaining gates. |

## Migration identity and CI

The exact CI-verified hashes remain:

- `20261104000300_profile_fields_and_private_media.sql`: `8e96c132b87491d8d9f503289779487ab5096222bf99da4705f5caaaa54c09df`
- `20261104000400_application_map_settings.sql`: `2b7d2fd75db77009fcb6625b013fb7078c679740ac34a29629afa8577405f594`

The CI workflow applies the six migrations in chronological order to a disposable Supabase instance. It runs SQL preflight in a PostgreSQL read-only transaction, then database lint, all three pgTAP suites, fixture validation, and cleanup. It does not connect to hosted Supabase.

The deployment workflow now checks the exact approved migration hashes, parses Supabase CLI's current ASCII migration table, requires the pending set to match the allowlist, compares the dry-run filenames to the pending versions, and runs schema checks in a read-only database transaction. The apply path is manual and remains behind the `webgista-dev` GitHub Environment.

## Hosted read-only findings

- The protected workflow confirmed the configured development target and migration hashes.
- Remote migration history is consistent with the local chain. Only versions `20261104000300` and `20261104000400` are pending.
- The hosted schema preflight passed for the existing publication policies, grants, helper functions, Storage configuration, agency/camera relationships, and the pre-migration membership foreign key.
- The dry-run listed exactly the two approved migration files. No hosted migration was applied.
- Aggregate readiness returned 2 agencies (both private), 0 agency memberships, 1 administrator, 0 agency editors, and 2 CCTV rows. No identifiers were copied into this report. No data was modified.
- The membership foreign-key change is compatible with the observed state: there are no membership rows to be affected. CCTV agency references remain protected by `RESTRICT`.

## Blockers and recovery gate

The development workflow queried `GET /v1/projects/{ref}/database/backups`. Run [41903581547](https://github.com/moel-ihsan/webgista/actions/runs/41903581547) returned HTTP 403 with `code: null` and no `missing_permissions`. A follow-up in [41904551690](https://github.com/moel-ihsan/webgista/actions/runs/41904551690) confirmed the same token can read the configured project (HTTP 200 and matching project ref), while the organization-plan query returned HTTP 403. Thus the configured project ref and basic project access are verified; the API did not identify `backups_read` as missing, and the plan could not be verified through that token. The user confirmed the organization is on the Free plan. Supabase documents no automatic daily backups for Free projects and recommends manual CLI dumps; its Management API documentation lists `backups_read` for fine-grained tokens. These facts do not establish whether this specific 403 is an entitlement or backup-specific authorization response. ([Free-plan backup guidance](https://supabase.com/kb/faqs/platform/free-plan-backups), [backup API permissions](https://supabase.com/docs/reference/api/v1-list-all-backups), [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore))

No existing private backup destination is configured: the GitHub repository is public, and the `webgista-dev` environment contains only Supabase access/database credentials and project-reference configuration. No dump was created or retained. A runner-local dump would disappear with the job; a public Actions artifact is not an approved recovery location.

The documented CLI logical backup path exports roles, schema, and data separately. Its coverage must be extended and restore-tested for this project's managed `auth`/`storage` customizations and authentication data; Storage object bytes are separate from PostgreSQL. Supabase documentation notes the CLI excludes managed schemas by default and that Storage objects and some platform settings require separate handling. No complete dump coverage or restore has been verified here. ([CLI dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump), [backup and restore details](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore))

The next required setup is a private, access-controlled backup destination outside this public repository (for example, a private S3 bucket with public access blocked, versioning/retention, and KMS encryption), plus a narrowly scoped GitHub OIDC role restricted to the `webgista-dev` environment and a dedicated object prefix. The backup workflow must produce the database dump, verify its coverage, restore it into an isolated Supabase-compatible environment, compare critical schema/row/relationship checks, and retain the encrypted artifact before the deployment workflow can accept it as recovery evidence. Do not add database credentials to the artifact or repository. Keep the backup gate closed until this path is provisioned and tested.

The backup check is required for `apply` and fixture-writing modes. Read-only `preview` and `verify` remain available. Do not apply migrations until a completed platform recovery point is accessible, or the private manual backup path is configured, retained, and successfully restore-tested. The backup-list endpoint requires `backups_read` for fine-grained tokens, but the observed response did not prove that permission is the cause; do not broaden the token until an authorized operator confirms the required scope. Do not bypass the GitHub Environment approval.

No rollback was attempted or claimed. If a future migration partially fails, stop further writes and inspect actual schema and migration history. Do not delete migration-history entries or automatically restore the whole project: restoring a backup may discard later user, agency, CCTV, or Storage metadata changes. The migration set is not assumed to have a safe inverse.

## Hosted acceptance still required

After backup access and the protected migration gate pass:

1. Verify migration history and installed schema/bucket policies read-only.
2. Use approved administrator and agency-editor test sessions to exercise profile fields, private photo upload/replacement/deletion, CCTV image upload/replacement/deletion, and cross-agency/anonymous denials through the Storage API.
3. Verify Settings persistence, agency registration and CCTV dropdown integration, and relevant map viewport behavior in Chrome.
4. Enable the profile and private-media development flags only after the corresponding hosted Storage and RLS tests pass. Keep agency removal disabled.
5. Re-run frontend verification and Chrome acceptance with an authenticated development session.

Current aggregate state has an administrator but no agency editor and no agency memberships. Editor-scoped hosted acceptance therefore also needs an already-authorized QA identity and legitimate membership. Do not create one by assigning a role or membership to an unrelated user.

## Verification references

- Isolated/feature branch database CI: [41901319126](https://github.com/moel-ihsan/webgista/actions/runs/41901319126)
- Hosted read-only preview: [41901846111](https://github.com/moel-ihsan/webgista/actions/runs/41901846111)
- Hosted read-only readiness verification: [41901997001](https://github.com/moel-ihsan/webgista/actions/runs/41901997001)
- Backup permission check: [41901652317](https://github.com/moel-ihsan/webgista/actions/runs/41901652317) — blocked by HTTP 403; no database write occurred.
- Sanitized project/backup diagnosis: [41904551690](https://github.com/moel-ihsan/webgista/actions/runs/41904551690) — correct project access verified; backup-list and organization-plan queries denied; migrations skipped.
- Local frontend verification: `npm run verify` passed; `git diff --check` passed in the main worktree.

## Phase 2D.6 dashboard/map parity follow-up

This section records the later targeted Dashboard and map work; it does not replace the historical acceptance findings above. The user reports that migrations 003 and 004 have since been applied successfully to `webgista-dev` and that the main authenticated Phase 2D workflows passed manual Chrome checks.

- V1 Dashboard source confirms “Office Profile” is populated from the signed-in user's profile endpoint, not an agency table. V2 now displays that user's saved address, coordinates, description, and private signed photo in both Dashboard and the header.
- Dashboard recent cards query RLS-visible CCTV rows ordered by `created_at DESC` (requested behavior), use signed private image previews, and link managers to edit or other visitors to the selected camera on Map View.
- Map popup and search-card visuals now follow the source v1 image size, compact horizontal cards, metadata hierarchy, and theme colors. Video remains unavailable until secure media access is designed; traffic remains No Data without observations.
- Agency removal stays disabled. Its stale “migration pending” message was corrected. Existing pgTAP covers RESTRICT behavior, and the baseline policy is administrator-only; this follow-up did not perform live role-scoped delete acceptance, so `VITE_AGENCY_REMOVAL_ENABLED` must remain false.
- Local result: `npm run verify` passed TypeScript, ESLint, 130 Vitest tests across 26 files, and production build; `git diff --check` passed. No hosted records or policies were changed.
- Authenticated browser acceptance of the new Dashboard, map popup/search visuals, and agency removal was not executed in this follow-up. See [Phase 2D.6 Dashboard and Map parity](PHASE_2D6_DASHBOARD_MAP_PARITY.md).

### Phase 2D.6 production deployment check — 2026-11-05

- Vercel project `webgista-v2` (`apps/web`, Vite) deployed the isolated Phase 2D.6 snapshot as production deployment `dpl_Dj4dtm8gbfQk3PQTN8AgR5Dni9AV`; Vercel returned `READY` and aliased `https://webgista-v2.vercel.app`.
- Vercel deployment verification returned HTTP 200. Direct requests to `/map`, `/settings`, `/profile`, and `/cctv/a60eb814-12dc-42df-b1f8-14234631dbeb/edit` also returned HTTP 200. Public deployed JS contains the expected Dashboard and popup/search strings.
- Fresh `npm run verify`: TypeScript and ESLint passed, 130 tests in 26 files passed, and Vite production build succeeded. `git diff --check` and staged diff checks passed.
- Unauthenticated headless Chrome showed the Map View shell, MapLibre controls, attribution, and traffic legend. The software-rendered screenshot did not show map tiles, so map imagery is pending normal Chrome confirmation. No authenticated session was available for current Dashboard/profile data, CCTV popup/search, or agency action acceptance.
- Agency deletion remains disabled and analytic video remains deferred. No migrations, hosted records, Storage settings, or feature flags were changed. Commit `59a06190f27b2862a0859aea7e79a74c220a750e` was pushed to the verified Vercel production branch; the automatic Git deployment `dpl_2Usvg9gAGyyUYyCAbzPkU3cxJFht` is `READY`.

## Phase 2E and Phase 3 progress — 2026-11-05

| Area | Status | Evidence |
|---|---|---|
| Phase 2E observation schema and RLS | VERIFIED — isolated CI | Disposable run [41964786459](https://github.com/moel-ihsan/webgista/actions/runs/41964786459), commit `7b5bec52e08ac95902f2d26fe992a12eb5b686a5`: 201/201 pgTAP assertions, migration preflight, lint, fixture validation, and cleanup passed. Migration 005 has not been applied to hosted Supabase. |
| Phase 2E frontend | IMPLEMENTED — hosted acceptance pending | Manual observations are separate from demo detections. Existing authorization is enforced by RLS; only disposable role-scoped pgTAP contexts have been executed. |
| Migration 005 deployment authorization | IMPLEMENTED LOCALLY — verification pending | Guard now hashes 005, permits only a chronological reviewed migration suffix, requires 005 as the sole pending migration for this apply, and limits the explicit development waiver to that exact version. The original 003/004 waiver remains separate. |
| Video Analytics demo UI | IMPLEMENTED — browser acceptance pending | `/analysis` includes two licensed annotated samples and their generated frame-level JSON. No live-source access, tracking, traffic-condition inference, or observation writes are claimed. |
| Local CV pipeline | VERIFIED — offline only | YOLOX-S processed both sample videos; Python pipeline tests passed 2/2. Results: 110 and 186 per-frame detection instances, not unique vehicles. |
| Hosted Phase 2E and online/browser acceptance | BLOCKED — not yet executed | Requires final feature-branch CI, the protected `webgista-dev` workflow with explicit 005 waiver, then deployment/browser checks. No hosted observation records were created. |

Latest local frontend verification for this worktree passed TypeScript, ESLint, 138 Vitest tests across 29 files, and production build. The latest isolated verification branch and its CI result are documented in the Phase 2E report; no hosted database or production deployment is represented as complete here.

### Phase 2E development promotion — 2026-11-05

- Feature branch commit `84442d750a6678901ba5bb4b8dd0b8bb1288b124` passed database CI run [41967327132](https://github.com/moel-ihsan/webgista/actions/runs/41967327132): all migration steps, preflight, lint, 201/201 pgTAP assertions, fixture validation, and disposable cleanup succeeded.
- The Vercel production deployment for that commit is `READY` at [https://webgista-v2.vercel.app](https://webgista-v2.vercel.app). `/analysis` and both annotated demo MP4 assets returned HTTP 200. This is HTTP/static acceptance only; no authenticated browser session was available.
- Hosted preview [41967582895](https://github.com/moel-ihsan/webgista/actions/runs/41967582895) verified the target, migration hashes/history, read-only preflight, and a dry-run containing only migration `20261105000100`.
- Hosted apply [41967673376](https://github.com/moel-ihsan/webgista/actions/runs/41967673376) applied migration 005 to `webgista-dev` under the explicitly selected one-time development data-loss waiver. Migration history and aggregate readiness checks passed. The final schema gate detected that `anon` has an effective `SELECT` grant on `latest_traffic_observations`, while the base table remains inaccessible to anon and the view uses `security_invoker=true`.
- Read-only verification [41967895943](https://github.com/moel-ihsan/webgista/actions/runs/41967895943) reproduced the same grant and failed closed. This confirms an ACL mismatch, not row exposure: readiness reports `anonymous_base_table_select=false`, `latest_view_security_invoker=true`, and `anonymous_latest_view_select=true`.
- A narrow follow-up migration `20261105000200_revoke_anonymous_latest_observation_view.sql` revokes SELECT from `anon` and `PUBLIC`, restoring the intended least-privilege view contract. Isolated CI run [41968591028](https://github.com/moel-ihsan/webgista/actions/runs/41968591028), commit `d8db72807f2c355af2db2abe4657aa3d797d9824`, applied all eight migrations, passed preflight/lint, pgTAP plans 119 + 36 + 20 + 27 = **202/202**, fixture validation, and cleanup. The final feature-branch run [41968966227](https://github.com/moel-ihsan/webgista/actions/runs/41968966227) also passed on `f3378f523bac003a0a6f9fae49a2a12e11d9f002`. Migration 006 remains **not applied** to hosted Supabase and requires separate approval and a matching update to the protected deployment allowlist; the existing guard intentionally rejects it as unapproved. No hosted observations or test rows were created.
- Manual observation CRUD and dashboard/map condition display are implemented but hosted end-to-end acceptance remains pending the ACL correction and real role-scoped sessions. The public demo is separate from observations and does not persist CV detections.
