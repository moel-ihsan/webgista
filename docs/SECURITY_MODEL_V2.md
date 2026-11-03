# WebGISTA v2 Security Model — Phase 2A

Authorization is enforced by PostgreSQL grants and Row Level Security (RLS), not by frontend routes. The browser may eventually use a public Supabase anon key; service-role keys, database credentials, and private camera secrets must never be included in Vue environment variables.

## Roles

| Actor | Database identity | Access |
|---|---|---|
| Public visitor | `anon` | Read approved active camera projection only. |
| Signed-in user without role | `authenticated` | Read/update their display profile and approved public camera information. |
| Agency editor | `authenticated` plus server-owned `user_roles` and `agency_memberships` rows | Manage camera metadata/configuration and observations only for assigned agencies; update assigned agency metadata; cannot manage memberships or roles. |
| Administrator | `authenticated` plus server-owned administrator row | Manage agencies, cameras, memberships, other users' roles, observations, and read audit history. Cannot change their own role through client RLS. |
| Trusted backend/DB owner | service role or direct migration connection | Bootstrap the first administrator and perform controlled maintenance. This credential bypasses RLS and must remain server-side. |

Auth `user_metadata` and `raw_user_meta_data` are never read by authorization policies. A user can edit metadata, so it cannot establish a role. RLS helpers read `public.user_roles` and `public.agency_memberships` through `private` security-definer functions with an empty search path and fully qualified object names.

## Default-deny controls

Every application table has RLS enabled. Migrations explicitly revoke inherited `anon` and `authenticated` privileges, then grant only required operations. A request must pass both PostgreSQL privileges and the relevant RLS policy.

- Missing policies deny operations.
- Public access is read-only and column-limited.
- Private camera configuration has no anonymous grant or policy.
- Audit history has no client insert, update, or delete grant.
- Security-definer helpers live in the unexposed `private` schema and have narrowly granted execution.
- `supabase/config.toml` disables automatic exposure of newly created tables.

## Policy overview

| Resource | Public visitor | Signed-in user | Agency editor | Administrator |
|---|---|---|---|---|
| Public CCTV projection | Approved active rows | Approved active rows | Approved plus assigned base rows | All base rows |
| Profiles | None | Own profile | Own profile | Read all; update display fields |
| Roles | None | Own role only | Own role only | Read all; assign/change/remove roles for other users |
| Agencies | Public agencies | Public agencies | Read/update assigned agencies | Create/read/update/delete |
| Memberships | None | Own memberships | Own memberships | Create/read/delete |
| CCTV metadata | Approved active rows | Approved active rows | Insert/update assigned agency cameras | Full management, including delete |
| Private CCTV config | None | None | Manage assigned camera configuration | Manage all camera configuration |
| Traffic observations | None | None | Insert/read/update assigned agency observations | Full management |
| Audit events | None | None | None | Read only |

Agency editors deactivate cameras with an update; only administrators receive CCTV delete permission. Foreign-key restrictions prevent deleting cameras or agencies that still have dependent research data.
Completed observations are immutable to agency editors; only an administrator can perform an audited correction or deletion.

## Role assignment and first administrator

There is no seeded administrator and no fixed password. The first user must be created through Supabase Auth invitation or another reviewed operator process. A database owner then bootstraps that known user ID once:

```sql
insert into public.user_roles (user_id, role)
values ('REAL-AUTH-USER-UUID', 'administrator');
```

Run this only through the Supabase SQL editor/direct administrative connection, never from browser code. Subsequent role assignments may be performed by an authenticated administrator after Phase 2B provides a reviewed management flow. Administrators cannot assign or rewrite their own role through client RLS, reducing self-promotion and accidental lockout paths.

## Public versus private camera data

Public data includes approved location metadata, responsible agency, snapshot path, category, coordinates, and modification time. It excludes source URIs, RTSP/private endpoints, credential references, internal notes, creator IDs, and role/membership data.

`cctv_private_config.credential_reference` is only an identifier for future secret management. Storing raw camera passwords, embedded URL credentials, Supabase service-role keys, or database passwords in this table is prohibited. A later ingestion service must resolve secrets outside the public Data API.

## Audit integrity

Database triggers append audit events after protected mutations. The trigger stores only identifiers and never serializes full private rows. Ordinary clients cannot forge or alter events, including administrators using the `authenticated` role. Direct database owners and service-role processes can bypass RLS by design and therefore require operational logging and tightly controlled credentials.

## Tests and remaining security work

`supabase/tests/phase_2a_security.test.sql` contains pgTAP checks for constraints, foreign keys, public projection filtering, denied anonymous writes, agency isolation, administrator access, self-promotion prevention, metadata distrust, private configuration visibility, and audit immutability.

The suite now plans 54 assertions and explicitly covers:

| Security boundary | Allowed and forbidden cases |
|---|---|
| Public cameras | Anonymous view and base-table reads return only active approved rows; GeoJSON coordinate order is checked. |
| Anonymous mutation | Agency insert plus CCTV update/delete attempts are denied. |
| Private camera configuration | The public view omits private columns and direct anonymous table access is denied. |
| Agency isolation | Editors can update/insert assigned agency and CCTV records but cannot change another agency's records. |
| Role assignment | An unprivileged user cannot self-promote, an agency editor cannot assign another user's role, and an administrator can assign a role only to another user. |
| Administrator self-role | Self-update and self-delete attempts leave the administrator role unchanged. |
| Completed observations | Agency editor correction is denied; administrator correction is permitted and audited. |
| Audit events | Ordinary users cannot insert; administrators can read but cannot insert, update, or delete events through the client role. |
| View/function security | The view's `security_invoker` option, helper execution grants, `SECURITY DEFINER`, and pinned search paths are inspected from PostgreSQL catalogs. |
| Actor/provenance spoofing | Auth metadata does not establish a role, trigger-stamped actors are verified, and protected actor/provenance columns reject client writes. |

The checks are authored but are not yet reported as passing: the local Mac has no Docker/PostgreSQL runtime, and the GitHub Actions workflow has not been pushed and executed.

Phase 2B must still address:

- invite and account recovery workflow;
- MFA requirement for sensitive administration, if appropriate;
- Storage bucket/object policies and upload validation;
- reviewed source-URI schemes and host allowlists;
- session expiry and reauthentication UX;
- administrative role-management UI with confirmation and audit display;
- integration tests through the Supabase Data API, in addition to SQL-level RLS tests.

The implementation follows Supabase's current guidance to combine explicit grants with per-operation RLS policies, keep security-definer helpers outside exposed schemas, pin their search paths, and test both allowed and forbidden cases. See the official [Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

