# WebGISTA v2 Web Application

This directory contains the isolated Phase 1 frontend for WebGISTA v2. The Laravel/Vue 2 application at the repository root remains the preserved v1 research artifact.

## Phase status

Implemented:

- Vue 3, TypeScript, Vite, and Vue Router foundation.
- Responsive GIS-oriented application shell and accessible navigation.
- Dashboard with explicit system readiness states and no fabricated traffic statistics.
- Interactive MapLibre GL JS map with four OpenFreeMap basemaps, navigation/scale controls, separate basemap/boundary states, and district interaction.
- A validated copy of the v1 Banda Aceh GeoJSON boundary.
- CCTV, traffic analysis, and settings placeholders that clearly identify deferred work.
- CCTV and traffic-observation domain contracts; Phase 2C adds a read-only RLS-scoped CCTV data source.
- ESLint, Vue TypeScript checking, production build, and Vitest unit test commands.
- Supabase email/password login, logout, session restoration, and expiration handling.
- Invitation-only access model with trusted database roles and agency memberships.
- Role-aware navigation and route guards for administrators and agency editors.
- Phase 2C Supabase CCTV reads, MapLibre clustering, markers, search, authorized metadata popups, and independent layer visibility.
- Phase 2D CCTV metadata management, profile/password pages, and local private-media upload integration prepared behind disabled-by-default flags.

Deferred by design:

- CCTV image Storage and added profile fields until the prepared migration is approved and applied to the target project.
- Invitation acceptance, password recovery, MFA, and object storage.
- Traffic observations, realtime updates, and computer vision.
- Deployment configuration.

## Requirements

- Node.js `^22.18.0` or `>=24.12.0`
- npm 10 or newer

## Install and run

From `apps/web`:

```sh
npm install
cp .env.example .env.local
npm run dev
```

The local URL is printed by Vite. OpenFreeMap styles require no access token. Supabase variables are needed for authentication, while the public application shell remains available without them.

## Commands

```sh
npm run dev         # Start the Vite development server
npm run type-check  # Check Vue and TypeScript
npm run lint        # Run ESLint without modifying files
npm run test        # Run unit tests once
npm run build       # Type-check and create dist/
npm run preview     # Preview the production build locally
npm run verify      # Run type-check, lint, tests, and build
```

## Phase 1 verification

On 2026-11-03, `npm run verify` completed successfully: TypeScript and ESLint reported no errors, all three boundary utility tests passed, and Vite produced a production build. A local production preview also served the application shell and GeoJSON asset successfully. At that point MapLibre was isolated in the lazy-loaded map route; the approved provider migration is recorded below.

## Phase 2B verification

On 2026-11-03, `npm run verify` completed successfully with the Supabase integration: TypeScript and ESLint passed, 23 unit tests passed across five files, and Vite produced the production build. `npm audit --omit=dev` reported zero production vulnerabilities. A local preview without Supabase environment variables served the public entry page, login route fallback, and existing GeoJSON asset successfully. Real-provider sign-in remains pending until a development Supabase project is configured.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | For sign-in | Public project URL from Supabase API settings. Public pages still work when omitted. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | For sign-in | Browser-safe publishable key. Never use a secret or service-role key. |
| `VITE_SUPABASE_PROFILE_FIELDS_ENABLED` | After migration | Set `true` only after migration `20261104000300` is applied; enables profile address, coordinates, and description. Defaults to `false`. |
| `VITE_SUPABASE_PRIVATE_MEDIA_ENABLED` | After Storage setup | Set `true` only after the same migration is applied and private buckets/policies are verified; enables profile and CCTV image upload and signed previews. Defaults to `false`. |
| `VITE_SUPABASE_ROI_DENSITY_ENABLED` | Production enabled after migration 010 | `true` enables per-camera ROI density configuration; keep `false` in environments where migration `20261106000100` is not applied. Defaults to `false`. |
| `VITE_AGENCY_REMOVAL_ENABLED` | After migration 004 | Set `true` only after `20261104000400` is applied and the membership foreign key is verified as `ON DELETE RESTRICT`. Defaults to `false` to prevent cascading membership deletion. |

Copy `.env.example` to `.env.local` and configure only the Supabase values needed for sign-in. Do not remove the map style's OpenStreetMap/OpenMapTiles attribution.

## MapLibre and OpenFreeMap

Phase 2B.9 uses MapLibre GL JS 6.16.0 with the OpenFreeMap public styles:

- Street: `https://tiles.openfreemap.org/styles/liberty`
- Light: `https://tiles.openfreemap.org/styles/positron`
- Dark: `https://tiles.openfreemap.org/styles/dark`
- Outdoor: `https://tiles.openfreemap.org/styles/bright`

The selector retains the v1 labels and controls. Bright is a general-purpose style, not a topographic equivalent of Mapbox Outdoors. The original Mapbox cartography and logo are not reproduced; the OpenFreeMap style attribution remains visible. The public tile service is provided as-is and may change or become unavailable; review [OpenFreeMap terms](https://openfreemap.org/tos/) before deployment. MapLibre GL JS 6 requires WebGL2. Initial basemap loading is time-bounded, and boundary GeoJSON errors are reported independently from basemap errors.

The v1 audit found that traffic markers were refreshed by one-second REST polling, not WebSockets. Its browser detector counted per-frame boxes without unique-vehicle tracking, and its condition formula was not verified as a complete MKJI volume/capacity calculation. CCTV location reads are now integrated in Phase 2C; observations and live traffic conditions remain later work under the audited security and research constraints.

### Phase 2C CCTV mapping

The map reads anonymous locations from `public_cctv_locations`; when a Supabase Auth session exists, it reads active rows from `cctv_locations`, with row visibility enforced by the existing database RLS. It selects location metadata and the opaque `snapshot_path` only; when private media is enabled, the path is exchanged for a short-lived signed image URL through Storage policies. The client never reads `cctv_private_config`, traffic observations, stream URLs, or credential references. Full-map markers remain No Data blue; Dashboard compact markers use the original camera category colors. Clusters, search, safe text popups, style restoration, and the CCTV layer toggle are implemented. Analytic video, traffic observations, Supabase Realtime, and browser CV remain deferred.

### Phase 2D.4 account and media preparation

The v1 profile fields (Name, Address, Lattitude, Longitude, Description, Photo) are represented in the Vue form. Name uses the current deployed profile contract; the added fields and both private image workflows are gated until the local migration is approved and applied. Password change uses Supabase Auth and now has prominent accessible success feedback. The v1 Analytic URL is confirmed as direct MP4 browser playback and remains unavailable until a credential-safe authorized media endpoint exists. See [CCTV field parity](../../docs/CCTV_CRUD_FIELD_PARITY_V1_V2.md) and [Supabase setup](../../docs/SUPABASE_SETUP.md).

No hosted CCTV records were queried and no real-project browser acceptance was run for this phase. If the authorized query returns zero rows, the map and search drawer show an explicit empty state; no camera fixtures are shipped.

Phase 2C verification on 2026-11-04: `npm run verify` passed TypeScript, ESLint, 51 Vitest assertions across nine files, and the production build. Vite reported its large lazy MapLibre chunk warning; the build completed successfully. `git diff --check` passed. Tests cover public/authenticated query selection, selected fields, empty/error results, coordinate validation, GeoJSON, clustering/expansion, visibility, search/navigation, repeated style restoration, and boundary coexistence. No hosted-project browser test or camera-data query was run.

### Phase 2B.9 verification

On 2026-11-04, `npm run verify` passed TypeScript, ESLint, all 30 Vitest tests, and the production build. `npm ls maplibre-gl mapbox-gl --depth=0` reported MapLibre GL JS 6.16.0 and no direct Mapbox GL JS dependency. The four OpenFreeMap style endpoints returned HTTP 200 with `application/json`. The build keeps the map route lazy but reports a 1,098.62 kB minified map chunk (298.42 kB gzip). A browser executable was unavailable in this environment, so map rendering and interaction remain pending manual verification in a WebGL2-enabled browser.

## Directory structure

```text
apps/web/
├── public/data/               # Static, reviewed geographic assets
├── src/
│   ├── assets/                # Application styles
│   ├── components/
│   │   ├── layout/            # Responsive application shell
│   │   ├── map/               # MapLibre UI and GeoJSON helpers
│   │   └── ui/                # Small reusable presentation components
│   ├── config/                # Validated public runtime/build configuration
│   ├── data/                  # Supabase CCTV data source and domain data contracts
│   ├── domain/                # CCTV and observation types
│   ├── map/                   # Boundary and CCTV layers, map helpers, and tests
│   ├── pages/                 # Route-level pages
│   └── router/                # Route definitions
├── .env.example
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Geographic data

`public/data/banda-aceh.geojson` is copied unchanged from the validated v1 file at `public/geojson/bandaacehgeojson.geojson`. It contains nine administrative features. Its original source, license, date, and CRS still need to be documented before production publication; reusing it here does not invent provenance.

## Architecture notes

- Route pages are lazy-loaded; MapLibre GL JS and its worker/CSS are loaded with the map route.
- No global state library is included. Page and component state is sufficient for Phase 1.
- Popup HTML is not generated from geographic properties. Feature information is rendered through Vue text interpolation.
- No v1 API or database is called.
- Vite client variables are public. Future Supabase service-role keys and private CCTV credentials must never be added here.
- Frontend route guards do not replace database RLS. Roles are read from `user_roles`; editable Auth metadata is ignored.

See [`docs/AUTHENTICATION_V2.md`](../../docs/AUTHENTICATION_V2.md) for hosted-project configuration and the invitation-only workflow.

