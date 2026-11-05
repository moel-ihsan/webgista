# Phase 3 — Offline Video Analytics Demonstration

## V1 behavior and limits

V1 initializes TensorFlow.js COCO-SSD in `resources/js/app.js:115-118` and detects objects from browser video frames in `resources/js/components/C_Videodetail.vue:308-410`. Its `timeupdate` handler captures the current video frame, runs `model.detect`, and draws detection boxes. The class mapping counts `truck`/`bus` and groups `person`/`motorcycle`/`bicycle` as motorcycles. Its `else if (cars)` branch uses the non-empty string `"car"`, so every unmatched class is counted as a car. It calculates a weighted score from one frame and posts the resulting label to `/update/keterangan/{id}`, replacing the camera's current `keterangan` rather than storing a timestamped observation. Camera creation also assigns `Great` when a URL exists, while edit assigns `Low`, without analysis evidence.

The legacy implementation has no multi-object tracker, unique passage counting, or durable analysis history. The `totalvehs` table has only `totalcar` and `totalmotor`; its related vehicle-update controller path is commented out and is not called by the active video component. The per-frame thresholds are not calibrated or validated in the source. V2 therefore preserves the useful concept of visual detections but does not reuse this class mapping, infer unique counts, or publish its traffic-condition formula as operational output.

## Local batch pipeline

`tools/traffic-analytics/analyze_video.py` processes a local authorized MP4 at one sampled frame per second using OpenCV Zoo YOLOX-S COCO in OpenCV DNN. It writes frame-level detections, timestamps, confidence, bounding boxes, per-frame vehicle detections, a peak-per-sampled-frame summary, provenance, and an H.264 annotated preview. Output marks `record_kind=demo_video_analysis`, `is_live_cctv=false`, `tracking.enabled=false`, and `condition=null`.

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
| `traffic_sample_01.mp4` | [City Intersection with Traffic and Signals](https://www.pexels.com/video/city-intersection-with-traffic-and-signals-36330668/), SHOX ART | 0:23 | H.264, 1280×720, 0.8 MB | 23 | 7 / 1 / 2 / 0 / 0 |
| `traffic_sample_02.mp4` | [Bustling Night Traffic at Ben Thanh Market](https://www.pexels.com/video/bustling-night-traffic-at-ben-thanh-market-29185480/), Media Dung | 0:26 | H.264, 1280×720, 5.9 MB | 26 | 7 / 1 / 1 / 9 / 0 |

Counts are model outputs, not ground truth or unique vehicle totals. The 1 FPS sample misses between-frame movement. The clips are public stock footage and are demo material, never live CCTV.

The generated JSON includes timestamps, boxes, confidence, model identifier, source license reference, and explicit no-tracking/no-condition metadata. Full-resolution source clips and complete analysis outputs remain in `/private/tmp/webgista-traffic-samples`; only the two compact annotated previews and corresponding JSON are included in the web app.

## WebGISTA demo UI

The `/analysis` page now has a separate Video Analytics demo panel. It offers the two already-processed Pexels samples, plays the H.264 annotated frame-sampled preview, and reads the actual JSON outputs for sample metadata, total detection instances, peak detections, and the frame currently shown by the preview. Each sample is labeled as demo footage, links to its source and license, and clearly says it is not live CCTV. The current frame list reports classes, confidence, and bounding boxes. The model samples at 1 FPS, so the annotated preview is intentionally frame-sampled rather than a continuous detector overlay.

The Pexels license permits use on websites/apps and modification subject to its restrictions; the video previews and compact JSON files are included as static WebGISTA demo assets. The two annotated videos total about 2.8 MB. Their original YouTube candidates remain unused because their reuse rights were not confirmed. This demo panel does not write to `traffic_observations`; manual observations remain separately labeled and persisted through the authorized Phase 2E flow.

## Acceptance status

- Local offline detection and annotation: executed on both licensed clips; 110 and 186 frame-level vehicle detection instances respectively.
- `/analysis` sample selector, annotated playback, and actual per-frame JSON results: implemented with component regression coverage; browser verification pending.
- Data contract and provenance output: generated and inspected.
- Tracking: not implemented or claimed.
- Traffic condition derivation: not implemented; no calibration supports it.
- V2 browser upload/playback workflow: not connected to this local CLI.
- Live CCTV analysis: not implemented. It would need a separately authorized media-access and persistent worker architecture; Vercel Hobby is not treated as a continuous processing host.
- Automatic insertion into Phase 2E: intentionally absent. A later authorized worker path must validate model provenance and distinguish demo from CCTV observations.
