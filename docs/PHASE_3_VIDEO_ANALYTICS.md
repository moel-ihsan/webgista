# Phase 3 — Offline Video Analytics Demonstration

## V1 behavior and limits

V1 initializes TensorFlow.js COCO-SSD in `resources/js/app.js:115-118` and detects objects from browser video frames in `resources/js/components/C_Videodetail.vue:308-410`. It draws boxes and calculates a per-frame condition, then overwrites a camera's `keterangan`. It has no multi-object tracker, no unique passage counting, and no durable analysis history. Its class mapping and per-frame traffic-condition formula are not reliable enough to reuse as operational output.

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

The generated `traffic_sample_01.analysis.json` and `traffic_sample_02.analysis.json` include timestamps, boxes, confidence, model identifier, source license reference, and explicit no-tracking/no-condition metadata. Annotated H.264 files are beside them in the same temporary directory. These files were kept outside the repository and Vercel deployment.

## Acceptance status

- Local offline detection and annotation: executed on both licensed clips.
- Data contract and provenance output: generated and inspected.
- Tracking: not implemented or claimed.
- Traffic condition derivation: not implemented; no calibration supports it.
- V2 browser upload/playback workflow: not connected to this local CLI.
- Live CCTV analysis: not implemented. It would need a separately authorized media-access and persistent worker architecture; Vercel Hobby is not treated as a continuous processing host.
- Automatic insertion into Phase 2E: intentionally absent. A later authorized worker path must validate model provenance and distinguish demo from CCTV observations.
