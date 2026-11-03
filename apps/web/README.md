# WebGISTA v2 Web Foundation

This directory contains the isolated Phase 1 frontend for WebGISTA v2. The Laravel/Vue 2 application at the repository root remains the preserved v1 research artifact.

## Phase 1 status

Implemented:

- Vue 3, TypeScript, Vite, and Vue Router foundation.
- Responsive GIS-oriented application shell and accessible navigation.
- Dashboard with explicit system readiness states and no fabricated traffic statistics.
- Interactive MapLibre map with navigation/scale controls, loading/error states, and district interaction.
- A validated copy of the v1 Banda Aceh GeoJSON boundary.
- CCTV, traffic analysis, and settings placeholders that clearly identify deferred work.
- Future CCTV and traffic-observation TypeScript contracts without a backend implementation.
- ESLint, Vue TypeScript checking, production build, and Vitest unit test commands.

Deferred by design:

- Supabase/PostgreSQL/PostGIS and all data migration.
- Authentication, authorization, and object storage.
- CCTV CRUD, traffic observations, dashboards, realtime updates, and computer vision.
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

The local URL is printed by Vite. The environment file is optional because Phase 1 has a documented no-key basemap default.

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

On 2026-11-03, `npm run verify` completed successfully: TypeScript and ESLint reported no errors, all three boundary utility tests passed, and Vite produced a production build. A local production preview also served the application shell and GeoJSON asset successfully. MapLibre remains isolated in the lazy-loaded map route; Vite reports that route above its default 500 kB chunk warning threshold.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_MAP_STYLE_URL` | No | Public MapLibre style URL. Defaults to OpenFreeMap Liberty. Do not put secret tokens in Vite variables because they are included in the browser bundle. |

OpenFreeMap's public instance requires attribution, permits web/application usage under its terms, and does not require an API key. MapLibre displays the style's attribution. Review [OpenFreeMap's terms](https://openfreemap.org/tos/) before deployment because provider terms can change.

## Directory structure

```text
apps/web/
├── public/data/               # Static, reviewed geographic assets
├── src/
│   ├── assets/                # Application styles
│   ├── components/
│   │   ├── layout/            # Responsive application shell
│   │   ├── map/               # MapLibre UI
│   │   └── ui/                # Small reusable presentation components
│   ├── config/                # Validated public runtime/build configuration
│   ├── data/                  # Future data-source contracts; no backend yet
│   ├── domain/                # CCTV and observation types
│   ├── map/                   # Boundary loading, validation, and tests
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

- Route pages are lazy-loaded; MapLibre is downloaded only when the map page is opened.
- No global state library is included. Page and component state is sufficient for Phase 1.
- Popup HTML is not generated from geographic properties. Feature information is rendered through Vue text interpolation.
- No v1 API or database is called.
- Vite client variables are public. Future Supabase service-role keys and private CCTV credentials must never be added here.

