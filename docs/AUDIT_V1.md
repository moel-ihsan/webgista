# WebGISTA v1 Repository Audit

Audit date: 2026-11-03

Audited revision: `15933555f1796e32419185fa3a33cb6c76910ea8`

Scope: all 235 tracked files were inventoried. Source entry points, routes, controllers, models, migrations, factories, seeders, authentication configuration, Vue components, GIS code, computer-vision code, uploads, build/deploy files, tests, and documentation were inspected. Generated/minified assets and presentation-only CSS were not reviewed line by line.

## What this repo does

WebGISTA is a Laravel 8 and Vue 2 academic Web GIS. It stores CCTV locations, renders them with Mapbox GL, attempts COCO-SSD inference on browser video frames, and writes a traffic-condition label back to the CCTV record. The expected v2 load used for this audit is a small academic deployment: tens of concurrent map viewers, a few administrators, and at most a few simultaneous detection sessions—not continuous server-side processing of every live camera.

## Severity

- **P0:** exploitable security issue, destructive behavior, or data corruption. Fix before any public deployment.
- **P1:** incorrect core research result, broken supported flow, unsupported runtime, or serious reliability gap. Fix before calling v2 functional.
- **P2:** maintainability, reproducibility, documentation, or cleanup work that can follow the safe core.

## Architecture and dependency baseline

- Server-rendered Blade pages mount globally registered Vue 2 components from `resources/js/app.js`.
- Custom JSON endpoints live mostly in `routes/web.php`; two endpoints live in `routes/api.php`. There is no application service layer or state store. Components call Axios directly and contain domain, map, and persistence logic.
- Data access is direct Eloquent CRUD. `CctvPoint`, `AgencyList`, and `MapSetting` have no declared relationships. Agencies are copied into CCTV rows as strings.
- Authentication is split between Fortify/Jetstream scaffolding and a custom `AuthController`. Only `HomeController`, which is not routed, applies `auth` middleware.
- Mapping uses Mapbox GL JS and a static Banda Aceh GeoJSON boundary. Computer vision uses TensorFlow.js and COCO-SSD in the browser.
- The deploy artifact is a Heroku `Procfile`. There is no Dockerfile, Render blueprint, health check, CI workflow, storage provisioning, or deployment guide.

## Must fix

### 1. P0 — All custom data mutations bypass authentication and authorization

- **What this is:** CCTV, agency, map-setting, traffic-state, profile, image, and password writes are registered without `auth` or policy middleware in `routes/web.php:27-78` and `routes/api.php:21`.
- **Problem:** An anonymous request can create or change CCTV data, change map settings, upload files, or update another user by choosing their ID. UI checks such as `v-if="role == 'admin'"` in `resources/js/components/C_Table.vue:106-130` only hide buttons; they do not protect the server.
- **Fix:** Put administrative routes behind session authentication, enforce a server-side admin/operator policy per resource, and keep only an explicit read-only projection public. Authorize the current user rather than accepting a target user ID for self-service profile/password operations.
- **If we skip it:** Anyone who can reach the site can change research data or account records.

### 2. P0 — Deletes and logout use GET

- **What this is:** CCTV deletion, agency deletion, and logout are GET routes (`routes/web.php:36,61,74`) called by links/Axios (`C_Table.vue:304-320`, `C_Settings.vue:225-228`).
- **Problem:** Crawlers, prefetchers, cross-site links, or a malicious image URL can trigger state changes. GET requests also bypass Laravel's CSRF protection.
- **Fix:** Use `DELETE` for records and `POST` for logout, retain CSRF protection, require authorization, and confirm deletion in the UI.
- **If we skip it:** Users can be logged out or records deleted by visiting a page they did not expect to mutate data.

### 3. P0 — A seeded deployment has a published administrator password

- **What this is:** `database/factories/UserFactory.php:26-30` creates a fixed administrator email with password `gas`; `DatabaseSeeder.php:16` always creates it.
- **Problem:** Anyone reading the repository knows the credentials of a database initialized with the default seeder.
- **Fix:** Remove fixed credentials. Bootstrap the first admin from deployment secrets or an explicit one-time command, and rotate any deployment that used this seed.
- **If we skip it:** A newly seeded public deployment can be taken over immediately.

### 4. P0 — Stored HTML injection reaches Mapbox popups

- **What this is:** CCTV URLs and names are interpolated into HTML strings and passed to Mapbox `setHTML`, for example `resources/js/components/C_Map.vue:407-424,570-584` and `CardInfoCCTV.vue:127-146`.
- **Problem:** Because anonymous callers can store an arbitrary `url`, a value containing a quote and HTML can execute script when a viewer opens a popup. This is stored cross-site scripting (stored XSS).
- **Fix:** Validate stream URLs against allowed schemes/hosts, build popup DOM nodes with `textContent` and element properties, and never pass database strings to `setHTML`.
- **If we skip it:** Opening the map can run attacker-controlled code in a user's authenticated browser.

### 5. P0 — Uploads accept unvalidated content and the create flow shares one temporary file

- **What this is:** Upload actions call `file('image')->storeAs(...)` without server-side type/size checks (`CctvPointModelController.php:147-163`, `AuthController.php:66-83`). New CCTV uploads always overwrite `public/cctv/image/tmp.jpg`, then a separate request moves it during `store` (`CctvPointModelController.php:51-61`).
- **Problem:** Two users can overwrite each other's pending image; a failed or skipped upload can attach stale/missing content. Edit flows attempt to delete the old path before the replacement is safely stored, and their stored path omits the `public/` prefix used by the default disk, so cleanup is inconsistent.
- **Fix:** Validate `required|image|mimes:jpg,jpeg,png|dimensions...|max:...`, create the row and uniquely named file in one authorized request, store the new file before deleting the old one, and delete associated files when a row is deleted.
- **If we skip it:** Files can be mixed between users, invalid content can be served as an image, and edits/deletes leak or lose files.

## Should fix

### 6. P1 — The detector classifies every unhandled object as a car

- **What this is:** `resources/js/components/C_Videodetail.vue:333-357` defines `const cars = "car"` and tests `else if (cars)`.
- **Problem:** A non-empty string is always true. Any COCO result that is not a truck/bus or in the bike list becomes a light vehicle. The bike list also counts `person` and `bicycle` as motorcycles.
- **Fix:** Compare explicitly: `result.class === 'car'`; map only `motorcycle` to motorcycle, `truck|bus` to heavy vehicle, and define whether bicycles are excluded or reported separately.
- **If we skip it:** The research output overcounts cars and motorcycles with unrelated objects.

### 7. P1 — The displayed totals are per-frame detections, not unique vehicle counts

- **What this is:** Counters are reset inside every `timeupdate` callback (`C_Videodetail.vue:315-323`) and incremented once for each bounding box in one `model.detect` result (`:328-370`). There is no object identity, tracking, or line crossing.
- **Problem:** The same vehicle is detected again in later frames, while the UI is reset between callbacks. The result is an instantaneous frame observation. It cannot be described as throughput or unique vehicles.
- **Fix:** Name the current mode `frame detections`, or add a documented tracker and count a track once when it crosses a calibrated line/zone. Persist the counting method, time window, model version, threshold, and source with each observation.
- **If we skip it:** Dashboard totals and traffic conclusions will claim a measurement the code did not make.

### 8. P1 — Traffic scoring applies an unexplained capacity formula to an unstable frame sample

- **What this is:** Hardcoded weights `0.13`, `0.1`, `0.04`, capacity `4455 / 3600`, and six thresholds are applied at `C_Videodetail.vue:367-409`, then posted after each inference.
- **Problem:** There is no saved observation window, calibration source, lane count, camera geometry, or formula version. Per-frame detections can overlap asynchronously, so the stored condition can oscillate and cannot be reproduced later.
- **Fix:** Recover the thesis definition, unit-test it against worked examples, version the formula, and calculate from a defined time window of unique line crossings (or explicitly label a validated occupancy proxy).
- **If we skip it:** A color label can look authoritative while being scientifically irreproducible.

### 9. P1 — The region-of-interest pipeline has no backing schema and draws the fourth point incorrectly

- **What this is:** The video component reads `rec1x` through `rec5y` (`C_Videodetail.vue:172-211`), but `cctv_points` has no such columns (`database/migrations/2021_02_09_161419_create_cctv_points_table.php:16-27`). Three paths use `rec4x` for both x and y (`C_Videodetail.vue:276,287,300`).
- **Problem:** A fresh database returns undefined coordinates. The clip can collapse to an empty region even when a fourth y coordinate was intended.
- **Fix:** Store a validated, resolution-independent ROI polygon (normalized 0..1 coordinates), add a calibration UI, and use the actual y value. Test conversion at two video resolutions.
- **If we skip it:** Inference can run on a blank or wrong part of the frame.

### 10. P1 — Browser video inference only works for a narrow set of sources

- **What this is:** The component draws a remote `<video>` into canvas and calls `toBlob` without `crossorigin` (`C_Videodetail.vue:6-24,324-332`). YouTube is delegated to a plugin; MP4 is the only other declared type. There is no RTSP ingestion or HLS normalization.
- **Problem:** Cross-origin video without the source server's CORS approval taints canvas and blocks pixel export. Browsers do not directly decode arbitrary CCTV protocols/codecs, and inference plus canvas work occurs on the UI thread with no backpressure, so slow devices can queue overlapping work.
- **Fix:** Support local files and explicitly tested HTTPS MP4/HLS sources with CORS first. Run at a bounded sampling rate with one inference in flight. Treat RTSP/private/vendor streams as requiring an optional gateway/worker outside the free browser-only baseline.
- **If we skip it:** Some demo clips work, but many real CCTV feeds fail or freeze the page.

### 11. P1 — Fresh database migrations do not support the intended create/map flows

- **What this is:** `url` is non-nullable (`create_cctv_points_table.php:26`), while `store` deliberately assigns null for regular cameras (`CctvPointModelController.php:49-56`). The CCTV factory omits required `keterangan` (`CctvPointFactory.php:24-33`). No seeder creates the `map_settings` row, but map/add components dereference `settingMap[0]` (`C_Map.vue:351-370`, `C_Add.vue:357-380`).
- **Problem:** A regular camera insert can fail; the factory cannot create a valid row; and a fresh install can crash before a map exists.
- **Fix:** Make optional fields nullable, supply valid factory state, and seed or safely default the single map configuration. Add one fresh-migration smoke test.
- **If we skip it:** A clean deployment is not reproducible from migrations and seeders.

### 12. P1 — Dashboard vehicle metrics are placeholders, not persisted observations

- **What this is:** `CardVehicle.vue:58-73` sums `car` and `motor` fields that do not exist on `cctv_points`. `LineChart.js:33-60` uses fixed monthly numbers. Neither component is rendered by `C_Main.vue:1-11`. `TotalvehController` has no route, and `Totalveh` is not related to CCTV or time.
- **Problem:** The visible dashboard is essentially a CCTV map and first-user profile. Vehicle totals/trends are unfinished and cannot represent research history.
- **Fix:** Remove placeholder metrics from v2 until observations are persisted; then aggregate timestamped observation rows for cards and charts.
- **If we skip it:** Users can mistake demo numbers or `NaN` for measured traffic.

### 13. P1 — Map polling is wasteful and corrupts updates when row order changes

- **What this is:** Every map client fetches every CCTV row each second and assigns conditions by array index (`C_Map.vue:527-541`). Changing map style can run `style.load` again and create another interval.
- **Problem:** A delete/add/reorder can update the wrong feature or access an absent index. Ten viewers cause roughly 600 full-table requests per minute, and intervals are never cleared on component destruction.
- **Fix:** Poll a small `{id, condition, observed_at}` endpoint at a modest interval and update by ID, or use Realtime only if justified. Keep one timer and clear it on unmount.
- **If we skip it:** Status colors become wrong and load grows with every viewer/style change.

### 14. P1 — Dependencies are unsupported, vulnerable, and not runnable in the audited environment

- **What this is:** The lock resolves Laravel `8.83.27`, Vue `2.6.14`, Axios `0.21.4`, Livewire `2.12.6`, and other legacy packages. `composer audit --locked` reported 49 advisories affecting 14 packages; `npm audit --package-lock-only --omit=dev` reported 22 production vulnerabilities (3 critical, 8 high, 8 moderate, 3 low).
- **Problem:** Laravel 8 and Vue 2 are outside normal support. Composer specifically flags the locked Laravel and Livewire releases. The current PHP 8.2.4 cannot boot because `composer.json:10` requires PHP 8.2.8 or newer.
- **Fix:** Do not patch this dependency graph piecemeal. Build v2 on a currently supported framework set, keep one lockfile per ecosystem, and run audits in CI. If choosing Laravel, Laravel 13 currently requires PHP 8.3 and has security support through 2028-03-17.
- **If we skip it:** Known vulnerabilities remain and deployments vary or fail by runtime version.

### 15. P1 — Configuration and storage are not deployment-ready

- **What this is:** The same Mapbox public token is repeated in seven components; `APP_DEBUG=true` is the example default; uploads use local public storage; deployment is only `Procfile:1`; and the compiled JS is about 21 MB. TensorFlow.js is both bundled and loaded twice by CDN (`layouts/base.blade.php:155-159`).
- **Problem:** The Mapbox token is meant to be public, but it is hard to rotate/restrict when duplicated. Local uploads disappear on ephemeral free hosts. Debug defaults and duplicate ML payloads increase exposure and load time.
- **Fix:** Put public client configuration in validated build-time environment variables, URL-restrict the Mapbox token, use object storage, set production-safe environment defaults, and ship one TensorFlow.js copy with route-level lazy loading.
- **If we skip it:** Deployments lose uploads, expose avoidable diagnostics, and load excessive assets on low-memory devices.

## Nice to have

### 16. P2 — Tests and documentation do not protect the research flows

- **What this is:** Tests are only `assertTrue(true)` and a root-status check (`tests/Unit/ExampleTest.php`, `tests/Feature/ExampleTest.php`). `README.md` is the stock Laravel readme. Empty resource methods, unused team/API scaffolding, two authentication UIs, dead vehicle components, and both npm/yarn locks remain.
- **Problem:** Security rules, migrations, uploads, GIS projections, counting semantics, and the traffic formula can change without detection. A new maintainer cannot reproduce the experiment from the repository.
- **Fix:** Add a small set of high-value tests and project documentation first; delete unused scaffolding only after whole-tree usage checks during v2 migration.
- **If we skip it:** The next modernization can silently reintroduce the same correctness and security failures.

## Authentication and authorization assessment

Laravel's standard CSRF middleware is active for the `web` group, and model `$fillable` lists constrain mass assignment. Those protections are real, but they do not replace authentication, per-record authorization, or input validation. Fortify includes registration, password reset, profile updates, password updates, and 2FA (`config/fortify.php:105-114`), while the custom Vue flow implements separate login/profile/password endpoints. Jetstream teams/API features are disabled (`config/jetstream.php:31-35`), yet their actions, models, migrations, policy, and views remain.

The custom login uses Laravel `Auth::attempt`, but it has no explicit login throttle, returns HTTP 200 for bad credentials, and duplicates Fortify. Profile/password routes take an arbitrary user ID. `AuthController::init()` returns `User::first()` rather than the signed-in user, so the dashboard profile is not an authenticated identity.

## Database assessment

The schema uses string latitude/longitude fields and the misspelling `lattitude` across users, CCTV, and map settings. There are no foreign keys between CCTV and agency, no check constraints for coordinates/category/condition, and no observation history. `totalvehs` has no camera or timestamp relationship beyond Laravel timestamps. Team foreign IDs also lack declared foreign-key constraints.

For v2, migrate coordinates to PostGIS `geography(Point,4326)` or validated numeric longitude/latitude, normalize agencies, and store append-only observation windows. Do not mutate v1 migrations or the original database; transform into a new v2 database.

## Read-only checks actually run

| Check | Result |
|---|---|
| `git status --short` before documentation | Clean |
| `composer validate --no-check-publish` | `composer.json` valid; platform warning because PHP 8.2.4 is below required 8.2.8 |
| `composer check-platform-reqs` | All listed extensions pass; PHP requirement fails |
| `php artisan route:list` | Not executed: application bootstrap stopped at Composer's PHP platform check |
| `php artisan test` | Not executed: same platform check; no test is claimed as passing |
| PHP lint over tracked `*.php` | All tracked PHP files reported no syntax errors |
| GeoJSON parse | Valid JSON; `FeatureCollection` with 9 features |
| `composer audit --locked` | 49 advisories across 14 packages |
| `npm audit --package-lock-only --omit=dev` | 22 production vulnerabilities: 3 critical, 8 high, 8 moderate, 3 low |
| Installed top-level npm tree | Resolved successfully; Vue 2.6.14, TensorFlow.js 3.11.0, COCO-SSD 2.2.2, Mapbox GL 2.3.1 |
| Asset/environment size | `public/js/app.js` about 21 MB; `node_modules` about 528 MB; `vendor` about 60 MB |
| Secret scan of tracked source | `.env` is ignored and was not read; no private credential found. A public Mapbox token and fixed seeded admin password were found. |

## Verdict

**Verdict:** preserve v1 as the research artifact, but do not deploy it publicly; fix access control and data semantics first, then rebuild v2 on a supported stack.

**Lean:** v2 can remove Jetstream teams/API scaffolding, the custom/Fortify duplication, `totalvehs`, placeholder charts, duplicate TF/CDN loads, unused map plugins, and one of the two JS lockfiles; exact line/dependency savings require implementation-time usage verification.

**Not checked:** the original database and `.env` values were intentionally untouched; no browser/device/CCTV stream test, production build, migration, or PHPUnit run was possible in this audit.

