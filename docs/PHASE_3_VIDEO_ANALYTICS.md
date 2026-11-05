# Phase 3 — Offline Video Analytics Demonstration

## V1 behavior and limits

V1 initializes TensorFlow.js COCO-SSD in `resources/js/app.js:115-118` and detects objects from browser video frames in `resources/js/components/C_Videodetail.vue:308-410`. Its `timeupdate` handler captures the current video frame, runs `model.detect`, and draws detection boxes. The class mapping counts `truck`/`bus` and groups `person`/`motorcycle`/`bicycle` as motorcycles. Its `else if (cars)` branch uses the non-empty string `"car"`, so every unmatched class is counted as a car. It calculates a weighted score from one frame and posts the resulting label to `/update/keterangan/{id}`, replacing the camera's current `keterangan` rather than storing a timestamped observation. Camera creation also assigns `Great` when a URL exists, while edit assigns `Low`, without analysis evidence.

The legacy implementation has no multi-object tracker, unique passage counting, or durable analysis history. The `totalvehs` table has only `totalcar` and `totalmotor`; its related vehicle-update controller path is commented out and is not called by the active video component. The per-frame thresholds are not calibrated or validated in the source. V2 therefore preserves the useful concept of visual detections but does not reuse this class mapping, infer validated unique counts, or publish the legacy formula as operational output.

## Local batch pipeline

`tools/traffic-analytics/analyze_video.py` processes an authorized MP4 using OpenCV Zoo YOLOX-S COCO in OpenCV DNN. It writes frame-level detections, timestamps, confidence, bounding boxes, per-frame vehicle detections, a peak-per-sampled-frame summary, provenance, and an H.264 annotated preview. Output marks `record_kind=demo_video_analysis`, `is_live_cctv=false`, and `condition=null`.

Vehicle classes are mapped transparently: car → LV, bus/truck → HV, motorcycle → MC, bicycle → bicycle. Person detections and unsupported classes are excluded. The current v2 JSON separates repeated detection instances, heuristic track IDs, and finite-segment crossing events. Demo output is never inserted into `traffic_observations`.

The detector is OpenCV Zoo's YOLOX-S COCO ONNX model (`object_detection_yolox_2022nov_int8.onnx`), Apache-2.0 according to the [official OpenCV Zoo model README](https://github.com/opencv/opencv_zoo/blob/main/models/object_detection_yolox/README.md). The upstream helper and model license are retained under `tools/traffic-analytics/`. No weights or sample videos are included in this repository. The CLI is offline and requires Python, OpenCV, NumPy and ffmpeg; it is not a continuous Vercel worker or a live-stream service.

## Sample rights and observed results

The two requested YouTube pages were checked for title and duration through page metadata:

| Candidate | Title | Duration | Reuse status |
|---|---|---:|---|
| `wqctLW0Hb_0` | Road traffic video for object recognition | 34:08 | License/permission not confirmed; not copied |
| `QuUxHIVUoaY` | 4K Road traffic video for object detection and tracking | 34:53 | License/permission not confirmed; not copied |

YouTube says content may be reused independently only when expressly authorized or with prior written permission; its standard license is the default. Since the individual reuse rights could not be confirmed, no YouTube clip was downloaded or processed. See [YouTube Terms](https://www.youtube.com/t/terms) and [YouTube license guidance](https://support.google.com/youtube/answer/2797468).

Instead, two clips marked Free under the [Pexels Free Stock Photo & Video License](https://www.pexels.com/license/) were downloaded and transcoded for local testing only. Pexels permits downloading, modification, and use subject to its stated restrictions. The source pages identify duration and content:

| Output in `/private/tmp/webgista-traffic-samples` | Source / creator | Source duration | Encoded output | Sampled frames | Peak sampled-frame detections (car / bus / truck / motorcycle / bicycle) |
|---|---|---:|---|---:|---|
| `traffic_sample_01.mp4` | [City Intersection with Traffic and Signals](https://www.pexels.com/video/city-intersection-with-traffic-and-signals-36330668/), SHOX ART | 0:23 | H.264, 960×540, 0.3 MB | 111 at 4.795 FPS | 574 total instances; peak car / bus / truck / motorcycle / bicycle: 8 / 1 / 2 / 0 / 0 |
| `traffic_sample_02.mp4` | [Bustling Night Traffic at Ben Thanh Market](https://www.pexels.com/video/bustling-night-traffic-at-ben-thanh-market-29185480/), Media Dung | 0:26 | H.264, 960×540, 1.7 MB | 132 at 5 FPS | 1,032 total instances; peak car / bus / truck / motorcycle / bicycle: 7 / 1 / 1 / 12 / 0 |

Those counts describe an earlier 4K-source run and are superseded by Phase 3E.1's reproducible run against the actual 1280×720 site assets below. All model counts are experimental, not ground truth or unique-vehicle totals. The clips are public stock footage and demo material, never live CCTV.

The generated JSON includes timestamps, source frame indices, boxes, original COCO IDs/classes, mapped traffic categories, configuration, track summaries, crossing events, and provenance. Original full-resolution downloads and model weights remain outside the repository; the licensed compact site clips, annotated previews, and JSON are included in the web app.

## WebGISTA demo UI

The `/analysis` page has a separate Video Analytics demo panel. It offers both Pexels samples, plays the H.264 annotated frame-sampled preview, and reads the actual JSON output for metadata, detection instances, peak detections, and the frame currently shown. Each sample is labeled as demo footage, links its source and license, and says it is not live CCTV. The current frame list reports classes, confidence, and bounding boxes.

The Pexels license permits use on websites/apps and modification subject to its restrictions; the video previews and compact JSON files are included as static WebGISTA demo assets. The two annotated videos total about 2.8 MB. Their original YouTube candidates remain unused because their reuse rights were not confirmed. This demo panel does not write to `traffic_observations`; manual observations remain separately labeled and persisted through the authorized Phase 2E flow.

## Acceptance status

- Local offline detection, heuristic tracking, and annotation: executed again on the actual site assets at 5 FPS; see Phase 3E.1 results below.
- `/analysis` sample selector, annotated playback, and actual per-frame JSON results: implemented with component regression coverage; browser verification pending.
- Data contract and provenance output: generated and inspected.
- Tracking: experimental same-class centroid association with linear velocity prediction, finite line-segment intersection, allowed direction, and once-per-track event suppression. No manual ground truth is present, so identity and event accuracy are not established.
- Traffic condition derivation: not implemented; no calibration supports it.
- V2 browser upload/playback workflow: not connected to this local CLI.
- Live CCTV analysis: not implemented. It would need a separately authorized media-access and persistent worker architecture; Vercel Hobby is not treated as a continuous processing host.
- Automatic insertion into Phase 2E: intentionally absent. A later authorized worker path must validate model provenance and distinguish demo from CCTV observations.

## Phase 3C — CCTV demo-video association and traffic-method review

V1 `resources/js/components/C_Detail.vue:6-23` played its `url` for `Analytic` cameras and displayed `/storage/path_image` for `Regular` cameras. V2 now uses the existing RLS-protected `cctv_private_config` contract for agency managers. It recognizes only exact paths for the two local Pexels demo files with `source_kind=stored_clip`; arbitrary URLs and private stream values are never passed into the detail page. The Add/Edit form offers those two fixed choices rather than a free-form URL. The detail player is video-first, uses the uploaded signed CCTV image as poster/fallback, and labels the video **DEMO VIDEO — NOT LIVE CCTV** with creator/source/license links. A failed video falls back to the camera image.

The original QA camera `TEST — CCTV Simpang Jambo Tape` (`a60eb814-12dc-42df-b1f8-14234631dbeb`) can be associated from Edit CCTV. The second demo must use another authorized QA camera or a separately created, clearly marked QA camera. No production/hosted association is made by this code change; it requires an authenticated agency-manager session in the application.

### Phase 3D — popup playback, V/C calculation, and delete safety

Map popups now look up the existing RLS-protected demo association only after a user opens a camera. An approved demo uses its unannotated Pexels clip, muted autoplay, loop, inline playback, and `preload=none`; closing/changing the popup pauses playback and clears the source. Autoplay rejection shows a Play control and media errors fall back to the signed CCTV image. Reduced-motion and data-saving preferences suppress autoplay. The detail route continues to use the annotated MP4 with playback controls and the actual JSON metadata. Neither player runs inference. These changes are locally tested; authenticated Chrome playback has not been run in this worktree.

The paper's method describes vehicle flow in smp/hour, a 30-second observation, and `C = C0 × FCw × FCsp × FCsf × FCcs`. Its Jambo Tape example uses 1,650 smp/hour/lane, three lanes, and a 0.90 city-size factor to produce 4,455 smp/hour. The paper's stated LV/HV/MC equivalents are 1.0/1.3/0.4 for its described configuration. Those values are configuration inputs, not defaults for every camera. The v1 browser code instead evaluates detections from each `timeupdate` frame using `(0.13 × HV + 0.10 × LV + 0.04 × MC) / (4455 / 3600)` and overwrites `keterangan`; it does not derive hourly flow from an observation window. Its class mapping also sends people/bicycles to MC and every unmatched class to LV. Its source uses `score <= 0.6` for Great, while the paper's table starts Good at 0.60; the boundaries differ at 0.60. The calculation engine follows the explicit non-overlapping intervals requested for v2: Great `[0,.60)`, Good `[.60,.70)`, Average `[.70,.80)`, Poor `[.80,.90)`, Bad `[.90,1.00]`, Terrible `>1.00`.

`apps/web/src/domain/trafficCalculation.ts` is a standalone, tested calculation module. It accepts only validated tracked line-crossings covering at least 30 seconds, requires an explicit capacity configuration and a validation reference, converts the observed weighted count to smp/hour, calculates capacity from the five supplied factors, and classifies V/C. A valid measured zero is Great; missing/invalid data is unavailable. Bicycle counts require a configured PCE. It does not consume frame-detection totals or publish observations. The existing 23-second and 26-second stock clips have heuristic, unvalidated crossing events and no camera-specific capacity calibration, so they remain experimental demo results and produce no traffic condition. No CV result overwrites a manual observation.

CCTV delete remains administrator-only under the existing RLS policy. `traffic_observations.cctv_id` is `ON DELETE RESTRICT`, so a camera with history cannot be permanently deleted; the UI names that dependency and points users to deactivation, which preserves history. `cctv_private_config` is `ON DELETE CASCADE`. CCTV image objects are separate from PostgreSQL; new migration `20261105000400_cctv_image_orphan_cleanup.sql` adds administrator-only read/delete access for unreferenced `cctv-images` objects, enabling cleanup after a successful camera delete without granting access to referenced images or changing camera/observation foreign keys. Supabase rejects direct SQL deletes from `storage.objects`, so its authorization is covered through the real local Storage API test in `scripts/test-local-cctv-private-config-api.mjs`; pgTAP checks the exact policy roles and private row visibility. The migration has **not** been deployed. Its hash is `3a53ae34079d7352f520fe8ee94e9420f3bf495cf8fff98c55e96289237465d3`. Isolated database CI [run 42036759732](https://github.com/moel-ihsan/webgista/actions/runs/42036759732) passed all 220 pgTAP assertions and the Storage API checks. Protected read-only hosted preview [run 42037688300](https://github.com/moel-ihsan/webgista/actions/runs/42037688300) passed and reported only `20261105000400` pending; migration apply was skipped. Hosted apply remains gated on a separately approved recovery method and explicit apply authorization. If image cleanup is denied or fails, the UI reports the retained private object rather than claiming cleanup succeeded.

The research method is reported in Ahmad, Affan & Ardiansyah (2024), [DOI 10.1063/5.0203203](https://doi.org/10.1063/5.0203203). The paper itself reports limitations in camera viewpoint/detection quality. No ground-truth evaluation of the current YOLOX-S tracker exists, so crossings remain heuristic and are not validated vehicle volumes or congestion estimates.

### Original v1 calculation (verified in source)

`resources/js/components/C_Videodetail.vue:315-424` resets counts on each `timeupdate` frame, runs COCO-SSD, classifies `truck`/`bus` as HV, `person`/`motorcycle`/`bicycle` as MC, then uses `else if (cars)` where `cars` is the non-empty string `"car"`. That last branch classifies every remaining class—including unknown/non-vehicle labels—as LV. It computes:

```text
score = (0.13 × HV + 0.10 × LV + 0.04 × MC) / (4455 / 3600)
score <= 0.6        Great
0.6 < score <= 0.7 Good
0.7 < score <= 0.8 Average
0.8 < score <= 0.9 Poor
0.9 < score <= 1.0 Bad
score > 1.0        Terrible
```

The result is posted to `/update/keterangan/{id}` after each frame, replacing the camera condition instead of appending an observation. It is not a time-window flow count: the per-frame counters reset, and repeated vehicle instances are used as though they were traffic volume. The 2024 paper describes 30-second observation/capture intervals, but this v1 browser handler reacts to video `timeupdate` frames instead of aggregating those 30-second intervals. The paper describes vehicle classes and an MKJI 1997 V/C ratio/capacity model; its intersection capacity example is 4,455 smp/hour, derived from 1,650 × three approaches × 0.90 city-size factor. This stock video has no verified local road geometry, direction-specific calibrated capacity, or ground-truth count, so the old ratio is not applied to it. See the [2024 paper](https://doi.org/10.1063/5.0203203) and its [available full text](https://www.researchgate.net/publication/379182827_Banda_Aceh_traffic_conditions_real-time-mapping-at-intersections-based-on-WebGIS-and-machine-learning).

### Phase 3E.1 — tracking and ground-truth validation

`tools/traffic-analytics/tracker.py` now predicts the next centroid from recent velocity when association resumes after missed samples. Same-class one-to-one greedy association remains intentionally lightweight; candidates are gated by a configurable distance scaled for missed samples. Line events require a trajectory to cross the finite configured segment, obey the selected direction, and are emitted at most once per heuristic track. Per-video ROI and line geometry, sampling rate, confidence, movement gate, and missed-frame allowance are recorded in each analysis JSON. Annotated previews display mapped class, heuristic track ID, and the event marker.

COCO class mapping is explicit: COCO car→LV, motorcycle→MC, bus/truck→HV, and bicycle remains separate. Person and unsupported classes are ignored. Each raw detection retains COCO class ID/name, confidence, bounding box, and mapped category. Output separately reports detection instances, track IDs/track durations, and timestamped/frame-indexed crossing events. Track diagnostics such as one-sample track count are not accuracy scores.

The current result files were regenerated from the exact 1280×720 MP4s served by the site, using the local OpenCV Zoo YOLOX-S INT8 model, 0.35 confidence, 5 FPS, a 35-pixel movement gate, and up to two missed samples:

| Site sample | Duration / processed frames | Detection instances (car, bus, truck, motorcycle, bicycle) | Heuristic tracks | Heuristic crossing events |
|---|---:|---|---:|---:|
| 01 | 23.023 s / 111 | 510, 1, 29, 0, 0 (540 total) | 35; 5 single-sample | 4: 3 car, 1 truck |
| 02 | 26.000 s / 130 | 397, 37, 11, 456, 0 (901 total) | 263; 109 single-sample | 25: 11 car, 14 motorcycle |

These differ from the earlier 4K-source results because inference was rerun against the downscaled site MP4s. They are actual model/tracker outputs, not manually verified counts. See the Phase 3E.2 table for current track/crossing diagnostics. Do not interpret candidate crossings as distinct real vehicles. No P/R/F1 or count-error metric exists until a reviewer completes human labels.

`tools/traffic-analytics/annotation_review/` provides the manual workflow; run it with `python tools/traffic-analytics/annotation_review/serve.py`. It displays original video, ROI/counting line, candidate bookmarks, and whole-clip windows. Human events retain unique IDs, source frame/time, class, direction, status, reviewer note, and provenance. Predictions are never copied into labels. Evaluation requires a matching source hash, full playback coverage/attestation, resolved statuses, then one-to-one class/category + direction matching at the configured timestamp tolerance. Event labels do not provide tracking identity metrics such as IDF1.

The existing V/C module continues to accept only tracked-line-crossing inputs marked as ground-truth validated, at least 30 seconds, with explicit PCE and road-capacity configuration. Demo provenance is now rejected explicitly. The two clips are shorter than 30 seconds and have no ground-truth counts or camera-specific capacity, so `condition` remains null. Manual observation history is unaffected.

### Phase 3E.2 — ground-truth review and tracker diagnostics

`tools/traffic-analytics/annotation_review/serve.py` serves a loopback-only reviewer at `http://127.0.0.1:8765/tools/traffic-analytics/annotation_review/`. It uses the original source MP4, shows that video's configured ROI and finite counting line, and supports playback, timestamp seek, original-FPS frame steps, human event add/edit/remove, class/direction, reviewer notes, and Unreviewed/Confirmed/Corrected/Rejected/Uncertain states. The model crossings are candidate seek controls only. Review windows span the whole clip, including windows with no candidate; JSON export includes source SHA-256 and review coverage/attestation. Local state is browser localStorage: export the JSON to retain it. CSV is an inspection export; the evaluator consumes the validated JSON package.

Scoring refuses a package unless video ID/hash match, reviewer ID is present, every integer second is covered, the full-clip attestation is set, and event rows are resolved. Confirmed/corrected human events are one-to-one matched with same vehicle class/category and direction within 0.5 seconds by default. Rejected candidates remain excluded labels, and unmatched model candidates count as false positives when the review is complete. The report includes TP/FP/FN, precision/recall/F1, absolute count error, and per-class/category/direction counts. None of these metrics exist for the current clips because no human reviewer has completed the labels.

The rerun uses the same 5 FPS, 0.35 confidence, per-clip ROI/counting line, 35 px gate, and 2 missed samples. Video 02 has 263 IDs, including 109 one-sample tracks (41.4%) and 93 gap reacquisitions; Video 01 has 35 IDs, including 5 one-sample tracks (14.3%) and 20 gap reacquisitions. The confidence summary had double-counted each track's first detection; this summary-only bug is corrected without changing detections or associations. Singleton vs multi-sample median confidence is 0.504 vs 0.588 for Video 02 and 0.387 vs 0.476 for Video 01. Video 02 has zero detections outside its ROI; Video 01 has 187 excluded outside-ROI instances. Lower confidence in singleton tracks is consistent with weak short-lived detections but does not establish individual causes. Strict same-class greedy matching, no appearance/IoU feature, local rather than global assignment, 0.2 s sampling, occlusion, and expiry after two missed samples are plausible fragmentation mechanisms. Human frame review is needed before changing thresholds or claiming improvement.

The annotated MP4s are byte-identical to the previous outputs because inference and association behavior did not change. JSON files were regenerated with source hashes, source FPS/sample interval, and expanded track diagnostics. Crossings remain candidates, not validated unique-vehicle counts. No independent clip or held-out set exists, so future threshold selection on these two clips must be identified as development-set calibration.

To demonstrate V/C integration without implying real traffic, the existing synthetic unit input (10 LV, 2 HV, 5 MC in 60 seconds; PCE 1.0/1.3/0.4; configured capacity 1,485 smp/hour) yields 14.6 smp, 876 smp/hour, V/C≈0.59 and `Great`. This is a test fixture, not a traffic measurement. Real estimation still requires validated crossings, duration, class equivalents and road capacity. No such verified inputs exist for these demos; no experimental category or hosted observation is generated.

### Phase 3E.1 status

- Reproducible detector/tracker output and annotated previews: **implemented and locally executed** for both site samples.
- Taxonomy, config validation, direction, finite-line crossing, velocity recovery, no-duplicate event semantics, whole-clip JSON review evaluation, and result contract: **unit tested**.
- Ground-truth count accuracy and tracking accuracy: **not validated**; manual labels are still required.
- Operational automatic Traffic Condition: **unavailable**, correctly; the demo clips do not meet duration, ground-truth, and road-capacity requirements.
- Demo/operational separation: **enforced in the V/C module**; demo provenance cannot produce an operational condition.

### Phase 3C acceptance

- Demo-video association code, form selection, manager-only lookup, video-first rendering, image fallback, and attribution: implemented; automated tests cover allowlisting and fallback. Hosted camera associations and browser playback remain pending the administrator's Chrome session.
- YOLOX-S 5 FPS demos and heuristic line-crossing pipeline: executed locally; current 1280×720 assets yield 540/901 detection instances and 4/25 candidate crossings. Synthetic unit test verifies one crossing per track. The stock clips have not been manually annotated, so video-level count accuracy remains unverified.
- Automatic MKJI condition estimation: deferred. It needs locally validated direction-specific capacity, calibrated vehicle flow, and a defined observation window; no arbitrary category is inferred from stock footage.
- Real CCTV playback/processing: deferred until a secure authorized source and access contract are available. The UI does not expose credentials or unrestricted source URLs.

## Phase 3E — ROI density mode (local implementation)

ROI Density is a separate measurement from V/C. The default configuration is a 10-second non-overlapping window, refreshed every 10 seconds, with detections sampled at 5 FPS (about 50 expected samples per full window). Each accepted vehicle detection is counted once in each sampled frame when its bounding-box bottom-center point lies in the normalized ROI. Results are time-weighted using actual sample timestamps; missing intervals reduce coverage and are not treated as empty road. The calculation reports average and peak concurrent presence by supported class, busy time, approximate image-pixel coverage, and explicit validity status. It does not require tracks or count unique vehicles.

The `/analysis` demo and authorized CCTV detail show generated result JSON with an ROI outline. Current Pexels demo results are: Video 01 (23.023s), 0–10s average 2.6875/peak simultaneous presence 5, 10–20s average 3.6257/peak 6, and a 20–23.023s partial tail; Video 02 (26s), 0–10s average 6.86/peak 12, 10–20s average 7.32/peak 14, and a 20–26s partial tail. Their status is `uncalibrated`; no traffic condition is assigned. Peaks are the maximum total detections in one sampled frame; category-specific peaks are measured simultaneously within their categories, not summed from class maxima across different frames. The outputs derive from existing YOLOX-S sampled detections and are experimental demo footage, not live observations at the associated Banda Aceh map points. No tracking IDs are used in ROI Density.

ROI Density does not produce vehicles/hour, smp/hour, capacity, V/C, unique crossings, or validated road service levels. The existing V/C module and its tested thresholds remain unchanged. A calibrated estimate requires camera-specific thresholds supported by evidence; those values are not inferred from MKJI's V/C thresholds. Operational automatic Traffic Observations are not written by this offline demo pipeline.

The per-camera configuration table is proposed in migration `20261106000100_cctv_roi_density_config.sql`, with agency-manager RLS and normalized-geometry validation. Migration 010 has not been applied to hosted Supabase. Its feature flag defaults off; hosted acceptance and activation require separate migration approval and authorized real-source processing infrastructure. The browser config editor presently supports the two approved public demo MP4s only. Vercel does not run YOLOX inference; reproducible batch aggregation is handled by `tools/traffic-analytics/analyze_roi_density.py` from the existing offline analysis JSON and exported configuration.
