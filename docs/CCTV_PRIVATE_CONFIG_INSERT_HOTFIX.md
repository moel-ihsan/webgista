# CCTV Private Video Association INSERT Hotfix

## Finding

Chrome reported PostgreSQL `42501` while the administrator saved a demo-video association. The current client performs a direct `.insert()` for a new configuration (and a separate authorized `.select()` before that). It does not use UPSERT. Existing migrations granted INSERT only on selected columns, while PostgREST rejected the relation-level INSERT operation and suggested a table INSERT grant.

The existing `cctv_private_config_manager_insert` RLS policy remains the row-level boundary: the camera must belong to an agency the authenticated actor can manage, and `created_by` must resolve to `auth.uid()`. The `private.set_actor_columns()` trigger supplies the actor identity. Authenticated reads remain RLS-filtered to managed cameras; anonymous users retain neither table SELECT nor INSERT. The fix adds only the missing relation INSERT grant and does not add SELECT privileges.

## Changes

- Migration `20261105000300_grant_cctv_private_config_insert.sql` grants INSERT to `authenticated`.
- The existing Phase 2A pgTAP suite now verifies the relation grant, anonymous denial, administrator insert/update, authorized editor insert/update, cross-agency insert denial, and actor identity enforcement.
- The deployment guard pins the migration SHA-256 and accepts it only as the sole pending migration.
- The protected development workflow runs a read-only policy/privilege preflight before apply and after verification.
- The CCTV form keeps metadata, coordinates, and selected video after association failure. Code `42501` is reported as a database permission failure, distinct from a CCTV metadata failure.

## Verification status

The isolated CI run [41987487812](https://github.com/moel-ihsan/webgista/actions/runs/41987487812) passed on commit `694c90b15ffd2fd17362f9dc23c8d93c7d4df3c7`: nine migrations applied to the disposable stack, database lint and ACL/RLS preflight passed, pgTAP passed 130 + 36 + 20 + 27 = 213 assertions, fixture validation passed, and cleanup succeeded. The first CI attempt exposed the fixture's stale migration allowlist; the allowlist now includes 007 while still rejecting unknown versions.

The migration has not been applied to hosted Supabase. Hosted preflight/deployment requires the protected development workflow and its existing recovery and GitHub Environment gates. No remote database data was changed for this hotfix.
