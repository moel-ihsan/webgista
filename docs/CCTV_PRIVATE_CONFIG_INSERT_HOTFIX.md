# CCTV Private Video Association INSERT Review

## Finding

`cctv_private_config` has nine columns: `cctv_id`, `source_kind`, `source_uri`, `credential_reference`, `notes`, `created_by`, `updated_by`, `created_at`, and `updated_at`. The latter four are server-managed identity/timestamp columns; `source_uri` and `credential_reference` can contain private camera configuration.

Migration `20261103000200_phase_2a_security.sql` grants authenticated users column-scoped INSERT on `(cctv_id, source_kind, source_uri, credential_reference, notes)` and column-scoped UPDATE on editable configuration fields. It grants SELECT at table level, with RLS limiting returned rows to cameras the actor may manage. The INSERT policy checks agency authorization and `created_by = auth.uid()`. The actor trigger supplies `created_by`/`updated_by` and preserves the original creator on UPDATE.

The frontend uses `.insert()` for a new association, not UPSERT. It requests a returned row only on the UPDATE branch. Its INSERT payload contains only the granted columns. The generic PostgreSQL `42501` hint to grant relation INSERT is broader than required and would also allow writes to server-managed columns.

## Least-privilege resolution

Do not deploy migration 007 (`20261105000300_grant_cctv_private_config_insert.sql`). Column-level grants are sufficient for the current PostgREST request and table-level INSERT is unnecessary. The client reports `42501` distinctly so a permission rejection is not confused with saving CCTV metadata.

The Phase 2A pgTAP suite asserts that authenticated has no table-wide INSERT, authorized columns remain insertable, server-managed columns are not insertable, and anonymous access remains denied. A local PostgREST integration test signs in as disposable administrator and agency-editor identities and tests successful allowed-column insert/update, trigger actor identity, forged actor/timestamp rejection, cross-agency denial, and anonymous denial. Fixture setup/cleanup runs only against the disposable local Supabase stack.

## Verification

The broad-grant attempt (run `41987487812`) is superseded for this decision. The final least-privilege verification passed in [run `41992934692`](https://github.com/moel-ihsan/webgista/actions/runs/41992934692), commit `baba8001453077050598757028ca399f4dcbe5b1`: local migrations, database lint, PostgREST role tests, pgTAP 131 + 36 + 20 + 27 = **214/214**, fixture validation, and disposable stack cleanup all succeeded.

No hosted request or database change was made during this review. Migration 007 is not part of the promoted feature snapshot, so no migration 007 deployment or backup waiver is required. The protected hosted preview uses the same read-only SQL preflight, now checking table-wide versus column-level grants, anonymous denial, manager-scoped SELECT/INSERT RLS, and the actor trigger. It must also confirm hosted history ends at 006 with no pending migrations; stop before any apply.
