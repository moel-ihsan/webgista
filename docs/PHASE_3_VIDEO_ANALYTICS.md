# Phase 3 — Offline Video Analytics Demonstration

## V1 behavior and limits

V1 initializes TensorFlow.js COCO-SSD in `resources/js/app.js:115-118` and detects objects from browser video frames in `resources/js/components/C_Videodetail.vue:308-410`. Its `timeupdate` handler captures the current video frame, runs `model.detect`, and draws detection boxes. The class mapping counts `truck`/`bus` and groups `person`/`motorcycle`/`bicycle` as motorcycles. Its `else if (cars)` branch uses the non-empty string `"car"`, so every unmatched class is counted as a car. It calculates a weighted score from one frame and posts the resulting label to `/update/keterangan/{id}`, replacing the camera's current `keterangan` rather than storing a timestamped observation. Camera creation also assigns `Great` when a URL exists, while edit assigns `Low`, without analysis evidence.

The legacy implementation has no multi-object tracker, unique passage counting, or durable analysis history. The `totalvehs` table has only `totalcar` and `totalmotor`; its related vehicle-update controller path is commented out and is not called by the active video component. The per-frame thresholds are not calibrated or validated in the source. V2 therefore preserves the useful concept of visual detections but does not reuse this class mapping, infer unique counts, or publish its traffic-condition formula as operational output.

## Local batch pipeline

`tools/traffic-analytics/analyze_video.py` processes an authorized MP4 using OpenCV Zoo YOLOX-S COCO in OpenCV DNN. It writes frame-level detections, timestamps, confidence, bounding boxes, per-frame vehicle detections, a peak-per-sampled-frame summary, provenance, and an H.264 annotated preview. Output marks `record_kind=demo_video_analysis`, `is_live_cctv=false`, and `condition=null`.

Vehicle classes are mapped transparently: car → LV, bus/truck → HV, motorcycle → MC, bicycle → bicycle. Person detections do not become vehicle counts. Counts are detections in sampled frames, not distinct vehicles. There is no tracker and no calibrated mapping from these outputs to traffic condition. The JSON shape is a demo contract only; it is not inserted into `traffic_observations` automatically.

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

Counts are model outputs, not ground truth or unique vehicle totals. The original 1 FPS results miss between-frame movement. The clips are public stock footage and are demo material, never live CCTV.

The generated JSON includes timestamps, boxes, confidence, model identifier, source license reference, and no-condition metadata. Full-resolution source clips remain outside the repository; only compact annotated previews and corresponding JSON are included in the web app.

## WebGISTA demo UI

The `/analysis` page has a separate Video Analytics demo panel. It offers both Pexels samples, plays the H.264 annotated frame-sampled preview, and reads the actual JSON output for metadata, detection instances, peak detections, and the frame currently shown. Each sample is labeled as demo footage, links its source and license, and says it is not live CCTV. The current frame list reports classes, confidence, and bounding boxes.

The Pexels license permits use on websites/apps and modification subject to its restrictions; the video previews and compact JSON files are included as static WebGISTA demo assets. The two annotated videos total about 2.8 MB. Their original YouTube candidates remain unused because their reuse rights were not confirmed. This demo panel does not write to `traffic_observations`; manual observations remain separately labeled and persisted through the authorized Phase 2E flow.

## Acceptance status

- Local offline detection, heuristic tracking, and annotation: executed on both licensed clips at about 4.8–5 FPS. See Phase 3C notes below for limitations and observed line counts.
- `/analysis` sample selector, annotated playback, and actual per-frame JSON results: implemented with component regression coverage; browser verification pending.
- Data contract and provenance output: generated and inspected.
- Tracking: an experimental same-class nearest-centroid tracker can assign heuristic IDs and count one crossing per track for the configured virtual line. It is not validated against ground-truth tracks and must not be presented as reliable unique-vehicle counts.
- Traffic condition derivation: not implemented; no calibration supports it.
- V2 browser upload/playback workflow: not connected to this local CLI.
- Live CCTV analysis: not implemented. It would need a separately authorized media-access and persistent worker architecture; Vercel Hobby is not treated as a continuous processing host.
- Automatic insertion into Phase 2E: intentionally absent. A later authorized worker path must validate model provenance and distinguish demo from CCTV observations.

## Phase 3C — CCTV demo-video association and traffic-method review

V1 `resources/js/components/C_Detail.vue:6-23` played its `url` for `Analytic` cameras and displayed `/storage/path_image` for `Regular` cameras. V2 now uses the existing RLS-protected `cctv_private_config` contract for agency managers. It recognizes only exact paths for the two local Pexels demo files with `source_kind=stored_clip`; arbitrary URLs and private stream values are never passed into the detail page. The Add/Edit form offers those two fixed choices rather than a free-form URL. The detail player is video-first, uses the uploaded signed CCTV image as poster/fallback, and labels the video **DEMO VIDEO — NOT LIVE CCTV** with creator/source/license links. A failed video falls back to the camera image.

The original QA camera `TEST — CCTV Simpang Jambo Tape` (`a60eb814-12dc-42df-b1f8-14234631dbeb`) can be associated from Edit CCTV. The second demo must use another authorized QA camera or a separately created, clearly marked QA camera. No production/hosted association is made by this code change; it requires an authenticated agency-manager session in the application.

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

### Experimental tracker

The offline CLI now accepts normalized `--roi` and `--counting-line` geometry and an inference sampling rate up to 10 FPS. It uses same-class greedy nearest-centroid association with a configurable pixel-distance limit and up to two missed frames. Each track contributes at most one crossing event per processing run. The output separates raw per-frame detections from heuristic track IDs and line-crossing counts. Synthetic tests verify stable association and one event despite crossing back; this only validates the implementation's intended semantics, not its accuracy on occluded real-world traffic. The JSON explicitly calls tracking experimental. A track may split/merge or be lost after occlusion, and a line count is not ground-truth unique vehicles or calibrated traffic volume.

For the current stock clips, detector execution at 4.8–5 FPS produced one heuristic line crossing for sample 01 and eleven for sample 02 with the saved demo ROI/line geometry. The output video is a compressed 960×540 annotated preview and JSON has 111/132 sampled frames. These are experimental detector outputs, not traffic flow rates or congestion conditions. `condition` stays null and demo outputs are not written to `traffic_observations`.

### Phase 3C acceptance

- Demo-video association code, form selection, manager-only lookup, video-first rendering, image fallback, and attribution: implemented; automated tests cover allowlisting and fallback. Hosted camera associations and browser playback remain pending the administrator's Chrome session.
- YOLOX-S 4.8–5 FPS demos and heuristic line-crossing pipeline: executed locally; 574/1,032 frame detection instances and 1/11 line events respectively. Synthetic unit test verifies a track emits at most one crossing event per run. The stock clips have not been manually annotated, so video-level count accuracy remains unverified.
- Automatic MKJI condition estimation: deferred. It needs locally validated direction-specific capacity, calibrated vehicle flow, and a defined observation window; no arbitrary category is inferred from stock footage.
- Real CCTV playback/processing: deferred until a secure authorized source and access contract are available. The UI does not expose credentials or unrestricted source URLs.
