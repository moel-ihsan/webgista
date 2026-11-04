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
