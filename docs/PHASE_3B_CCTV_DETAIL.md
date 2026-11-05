# Phase 3B — CCTV Detail

## V1 reference findings

- `routes/web.php:68-69` registers `/detail/{cctvPoint:id}` for CCTV detail and `/detail/video/{cctvPoint:id}` for the separate video/analysis page.
- `resources/js/components/C_Detail.vue:3-67` renders a two-column layout: large media at left; camera thumbnail/category, name, address, longitude/latitude, agency, a small location map, and Back at right.
- In `C_Detail.vue:5-24`, category `Analytic` used the row's `url` directly as an autoplaying MP4 source; category `Regular` used `/storage/` plus `path_image`. The component received the full Laravel CCTV model.
- `resources/js/components/C_Table.vue:116-120` and `resources/js/components/CardRecent.vue:3-18` linked the eye/recent cards to `/detail/{id}`. `resources/js/components/C_Map.vue:210-232` displayed media in its map popup but had no detail action.
- `resources/js/components/C_Videodetail.vue:3-46` is a distinct legacy video-analysis experience. Its direct URL playback and in-browser processing are not reused as secure streaming contracts.

## V2 behavior

- `/cctv/:id` is the detail route. Map popup, CCTV Management, and Dashboard recent-camera cards link to it.
- Anonymous reads use `public_cctv_locations`; its security-invoker view restricts rows to active, public cameras owned by public agencies. Authenticated reads use `cctv_locations` and rely on the deployed RLS policies. An absent or RLS-hidden row receives the same not-found message.
- Only camera metadata and `snapshot_path` are selected. `cctv_private_config.source_uri` and credentials are not queried. Private image previews use the existing `cctv-images` signed-URL flow; URLs are refreshed before the five-minute expiry and cleared on route/auth changes.
- The detail prefers an authorized CCTV image. The legacy Analytic URL is not embedded because v2 has no server-mediated secure video playback contract. If no image is available, the page explains that secure playback/image is unavailable rather than inventing media.
- Latest saved observation and stored history come from `traffic_observations`, filtered by the selected CCTV and current RLS. Source is displayed as Manual, Computer Vision (browser/worker), or Legacy import. No observation is fabricated; inaccessible/no visible records display No Data available to this account.
- “View on Map” navigates to `/map?cctv=<id>`, reusing the current map's focus behavior. CCTV Coordinate Picker and offline `/analysis` demo remain separate.

## Verification status

Automated component and data-access tests cover public-vs-authenticated querying, private-field exclusion, RLS-hidden rows, signed image display, observation source/history, No Data, and map navigation. Full frontend verification is recorded with the Phase 3B change.

Browser acceptance still requires an authenticated Chrome session to verify a private CCTV, signed image expiry/refresh, and persisted observation history. No hosted CCTV or observation data is changed by this implementation.

## Deferred

- Secure live/video playback for a real CCTV source: requires an authorized server-mediated or signed playback contract; legacy URLs must not be exposed to the browser.
- Automatic traffic-condition estimation from detections: separate Phase 3C work; bounding boxes are not converted to congestion categories here.
