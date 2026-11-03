# WebGISTA v2 Database Schema — Phase 2A

Phase 2A defines a new Supabase PostgreSQL schema. It does not connect to, migrate, or modify the WebGISTA v1 database. The canonical schema is the ordered SQL in `supabase/migrations/`.

## Design decisions

- UUID primary keys and `timestamptz` timestamps are used throughout.
- Nullable `legacy_id` fields preserve traceability during a later read-v1/write-v2 migration.
- Agencies are normalized and referenced by UUID instead of copying an agency name into each camera row.
- Public camera metadata and private source configuration are separate tables.
- Observation rows represent bounded time windows. `frame_detections`, `tracked_line_crossings`, and `manual` are different counting methods and must not be combined as if they have the same meaning.
- No camera locations or traffic observations are seeded. The Banda Aceh GeoJSON remains a versioned frontend reference asset at `apps/web/public/data/banda-aceh.geojson`.

## Relationships

```text
auth.users
  ├── 1:1 profiles
  ├── 1:1 user_roles
  └── M:N agencies through agency_memberships

agencies
  └── 1:N cctv_locations
        ├── 1:0..1 cctv_private_config
        └── 1:N traffic_observations

admin_audit_events records protected mutations without copying source credentials.
```

## Tables

### `profiles`

Application profile data keyed to `auth.users.id`. It contains display information only; it has no role or authorization fields. A trigger creates the row when Supabase Auth creates a user.

### `user_roles`

Stores one server-controlled global role per privileged user:

- `administrator`
- `agency_editor`

An authenticated user without a row has no management role. Public visitors are represented by the Supabase `anon` database role, not by a database row. `granted_by` and `granted_at` record the server-authorized assignment. A constraint and RLS policy prevent self-granting.

### `agencies`

Normalized organizations responsible for cameras. Names are case-insensitively unique. `legacy_id`, `source_system`, and `source_reference` support a later controlled import from v1.

### `agency_memberships`

Maps an agency editor to one or more agencies. Membership does not grant administration and cannot be changed by an agency editor.

### `cctv_locations`

Contains publishable camera metadata:

- responsible agency;
- name, address, and category;
- longitude and latitude;
- optional snapshot object path;
- active/public approval flags;
- import provenance and audit columns.

It deliberately contains no stream URI, credential, token, or private connection data.

### `cctv_private_config`

One optional private configuration row per camera. It can hold a source kind, source URI, and an opaque credential reference. `credential_reference` must point to a future server-side secret facility; it must not contain a password or service-role key. This table has no anonymous privileges or policies.

### `traffic_observations`

One row describes one observation window. It records:

- camera and UTC start/end timestamps;
- counting method and processing status;
- browser, worker, manual, or v1-import provenance;
- model and algorithm versions when applicable;
- separate light vehicle, heavy vehicle, motorcycle, and bicycle counts;
- sampled-frame count and quality flags;
- creator/updater audit fields.

Counts must be nonnegative and the end timestamp must follow the start. A completed non-manual observation requires a positive frame count plus model and algorithm versions. No existing v1 detection result is treated as a unique-vehicle observation.

Agency editors may complete an assigned pending observation, but cannot rewrite it after completion. Administrators retain an audited correction path; ordinary deletes remain administrator-only.

### `admin_audit_events`

Append-only client-facing audit history for changes to roles, memberships, agencies, camera metadata/configuration, and observations. Trigger-generated events record actor, operation, entity, and non-sensitive identifiers. They do not copy source URIs or credentials. Authenticated clients receive read access only when they are administrators; no client role receives insert, update, or delete privileges.

## Coordinate and GeoJSON conventions

- `longitude` is stored first and constrained to `[-180, 180]`.
- `latitude` is stored second and constrained to `[-90, 90]`.
- Both use six decimal places, which is adequate for camera markers without adding a spatial extension.
- `public_cctv_locations.location_geojson` returns a GeoJSON Point with `[longitude, latitude]` order.

Phase 2A does not enable PostGIS. Current requirements are point validation, map display, and GeoJSON conversion; native numeric columns satisfy these with less local/runtime overhead. If radius, containment, nearest-neighbor, or administrative-boundary queries become necessary, a migration can add a generated `geography(Point, 4326)` derived from the existing longitude/latitude columns and a GiST index. The API contract and source data do not need to change.

The schema enforces global coordinate bounds but does not invent a Banda Aceh bounding box. Study-area validation should use the documented administrative boundary once its provenance and CRS are confirmed.

## Public projection

`public.public_cctv_locations` is a `security_invoker` view. It exposes only approved, active cameras whose agencies are public. Its columns are intentionally limited to public metadata and generated GeoJSON. The underlying tables retain RLS, and anonymous roles receive column-level `SELECT` grants only for fields needed by this projection.

## v1 migration mapping

| v1 source | v2 destination | Rule |
|---|---|---|
| `agency_lists` / copied agency strings | `agencies` | Normalize trimmed names and reconcile duplicates. |
| `cctv_points.id` | `cctv_locations.legacy_id` | Preserve source identity without reusing it as the primary key. |
| `longitude`, misspelled `lattitude` | `longitude`, `latitude` | Parse numeric values and quarantine invalid rows. |
| CCTV URL/source fields | `cctv_private_config` | Review scheme and sensitivity; never expose by default. |
| `keterangan` | optional import provenance only | Do not treat it as a verified observation. |
| `totalvehs` | no automatic import | Semantics and camera/time relationship are not established. |

No Phase 2A migration reads v1 or inserts application data.

## Automated migration verification

`.github/workflows/phase2a-db-test.yml` starts a fresh database-only Supabase instance on a GitHub-hosted Ubuntu runner. `supabase db start` applies migrations in filename order, database linting checks the resulting functions, and `supabase test db` runs the transactional pgTAP suite. The workflow uses no hosted-project credentials and never runs a remote command.

This workflow has been prepared but has not yet executed on GitHub Actions. Migration success must not be assumed until the first run completes successfully.

