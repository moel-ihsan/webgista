# CCTV Private Video Association INSERT Review

## Finding

`cctv_private_config` has nine columns: `cctv_id`, `source_kind`, `source_uri`, `credential_reference`, `notes`, `created_by`, `updated_by`, `created_at`, and `updated_at`. The latter four are server-managed identity/timestamp columns; `source_uri` and `credential_reference` can contain private camera configuration.

Migration `20261103000200_phase_2a_security.sql` already grants authenticated users column-scoped INSERT on `(cctv_id, source_kind, source_uri, credential_reference, notes)` and column-scoped UPDATE on the editable configuration fields. It grants SELECT at table level, but RLS limits rows to cameras the actor may manage. The `cctv_private_config_manager_insert` policy also checks agency authorization and `created_by = auth.uid()`. The actor trigger fills `created_by` and `updated_by`, and preserves the original creator on UPDATE.

The client uses INSERT for a new association, not UPSERT. Its `return=representation` behavior is only needed on the UPDATE branch; INSERT does not request a returned row. The earlier `42501` message was compatible with a request attempting to write a non-granted column such as `created_by`; PostgreSQL's hint to grant table INSERT was broader than necessary.

## Least-privilege resolution

Do not deploy `20261105000300_grant_cctv_private_config_insert.sql`. Table-level INSERT would grant access to all nine columns, including actor/timestamp fields, and is unnecessary. The verified frontend sends only the allowed fields. The trigger and RLS enforce actor identity and agency scope.

The frontend retains a specific `42501` error message. The database suite now asserts that table-level INSERT is absent and that server-managed columns remain non-writable. A disposable local PostgREST test exercises admin and agency-editor INSERT/UPDATE, forged actor/timestamp denial, cross-agency denial, and anonymous denial/read protection.

## Verification

The prior CI run `41987487812` tested the broader table-level grant and is not evidence for this least-privilege conclusion. The current verification branch removes migration 007, adds the real Data API test, and updates the database assertion. Its new CI result must pass before any promotion.

No hosted Supabase request or data change is part of this review. Since migration 007 is unnecessary, there is no migration 007 to apply and no backup waiver should be used. The protected deployment preview should continue to show no changes for migrations 001–006; any unrelated pending migration must be investigated separately.
