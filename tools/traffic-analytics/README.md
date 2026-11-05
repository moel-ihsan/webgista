# Offline traffic video analysis

This local batch tool runs OpenCV Zoo YOLOX-S COCO with OpenCV DNN. It reports repeated detection instances, heuristic tracker IDs, and virtual-line crossing candidates separately. It does not run in Vercel, process live CCTV, or write Traffic Observations.

## Setup and reproducible processing

```sh
python3 -m venv .venv-traffic
. .venv-traffic/bin/activate
python -m pip install -r tools/traffic-analytics/requirements.txt
curl -L 'https://huggingface.co/opencv/object_detection_yolox/resolve/main/object_detection_yolox_2022nov_int8.onnx' -o /tmp/yolox.onnx
```

Keep model weights outside the repository. The following per-video settings reproduce the checked-in site analysis (1280×720 source MP4s):

```sh
python tools/traffic-analytics/analyze_video.py apps/web/public/traffic-demo/traffic_sample_01.mp4 --model /tmp/yolox.onnx --json apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json --annotated apps/web/public/traffic-demo/traffic_sample_01_annotated.mp4 --source-reference 'Pexels: City Intersection with Traffic and Signals, SHOX ART; Pexels Free License' --sampled-fps 5 --confidence 0.35 --roi 0.55 0.48 0.44 0.43 --counting-line 0.74 0.55 0.74 0.9 --direction both --max-track-distance 35 --max-missed-frames 2

python tools/traffic-analytics/analyze_video.py apps/web/public/traffic-demo/traffic_sample_02.mp4 --model /tmp/yolox.onnx --json apps/web/src/data/traffic-demo/traffic_sample_02.analysis.json --annotated apps/web/public/traffic-demo/traffic_sample_02_annotated.mp4 --source-reference 'Pexels: Bustling Night Traffic at Ben Thanh Market, Media Dung; Pexels Free License' --sampled-fps 5 --confidence 0.35 --roi 0.02 0.4 0.96 0.58 --counting-line 0.52 0.42 0.52 0.96 --direction both --max-track-distance 35 --max-missed-frames 2
```

The JSON includes model/version and model SHA-256, source SHA-256, source dimensions/FPS, sampled FPS/frame interval, configuration, raw detections, track diagnostics, crossing candidates, and ground-truth status. Car→LV, motorcycle→MC, bus/truck→HV, and bicycle remains separate; people and unsupported COCO classes are excluded.

## Human ground-truth review

The local reviewer displays the unannotated clip and configured ROI/counting line, supports playback, timestamp seeking and source-frame stepping, and lets a human add/edit/remove events by class/direction/status/note. Model crossings are bookmarks only and are never copied into labels. Its 2-second timeline covers the entire clip, including intervals without predictions. It records reviewed playback intervals and requires a reviewer attestation; these are human-review aids, not cryptographic proof that the clip was watched.

```sh
python tools/traffic-analytics/annotation_review/serve.py
# Open http://127.0.0.1:8765/tools/traffic-analytics/annotation_review/
```

Export a JSON review package, resolve all unreviewed/uncertain rows, review the full clip, and attest. Then score it against the matching analysis JSON:

```sh
python tools/traffic-analytics/evaluate_ground_truth.py \
  apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json \
  /path/to/traffic_sample_01.ground-truth-review.json --tolerance-seconds 0.5
```

Scoring requires matching video ID and source hash, reviewer identity, complete playback coverage and attestation. Confirmed/corrected events are matched one-to-one by vehicle class/category, direction, and timestamp. Rejected candidate rows are excluded; an empty event list after a full review is valid ground truth and makes every unmatched prediction a false positive. Output includes TP/FP/FN, precision, recall, F1, absolute count error, and class/category/direction breakdowns. Event-level labels do not provide tracking identity metrics such as IDF1. CSV export is available for external review, but scoring consumes the validated JSON package.

## Current diagnostics and limits

At a requested 5 FPS, every fifth source frame is processed (about 0.209 seconds for clip 01 and 0.200 seconds for clip 02). The current sampled site assets yield:

| Clip | Duration / sampled frames | Detections | Heuristic track IDs | One-sample tracks | Crossing candidates |
|---|---:|---:|---:|---:|---:|
| 01 | 23.023 s / 111 | 540 | 35 | 5 (14.3%) | 4 |
| 02 | 26.000 s / 130 | 901 | 263 | 109 (41.4%) | 25 |

For Video 02, singleton detections have lower median confidence (0.504) than detections in longer tracks (0.588); all its detections are inside the configured ROI, so ROI exclusion does not explain its singleton tracks. At this sampling cadence, a 35 px gate, crowded/night footage, detector misses, occlusion, fast apparent motion, and greedy local matching can each fragment identities. Those are plausible contributors, not a proven per-track cause; a human frame review is needed to distinguish missed detections from association failure. Video 01 also has 187 detections outside its smaller ROI, which are intentionally not tracked. Tracker settings have not been tuned against the clips because no human ground truth is available.

There are no human-reviewed labels checked in, so the figures above are model/tracker outputs, not validated counts, and no P/R/F1 or count-error metric is available. Neither clip reaches the V/C module's 30-second minimum, nor has calibrated camera-specific capacity; the condition remains unavailable. Do not loop the videos, extrapolate crossings, infer congestion from detections, or record stock footage as Banda Aceh traffic.

## ROI Density — Phase 3E

`roi_density.py` is a separate, offline analysis method. It aggregates already sampled YOLOX detections in **consecutive, non-overlapping 10-second windows** using the configured 5 FPS default. It does not need tracking IDs or a virtual counting line. A detection is present when its bottom-center point falls inside the normalized rectangle or polygon and its class/confidence passes the configuration.

The time-weighted window output distinguishes average concurrent detections, peak detections, class statistics, approximate image-pixel coverage, busy duration, and sample coverage. A missing sample contributes missing observation time, not a zero count. A partial final window is reported as `partial` and is never classified. A complete window with enough coverage and no detections is a valid zero-presence observation. Image coverage is a low-resolution union of accepted bounding boxes clipped to the ROI; it is not physical road occupancy.

Reproduce the checked-in Pexels demo outputs (inputs are the existing local analysis JSONs):

```sh
python tools/traffic-analytics/analyze_roi_density.py \
  --analysis-json apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json \
  --config tools/traffic-analytics/demo_configs/traffic_sample_01_roi.json \
  --output apps/web/src/data/traffic-demo/traffic_sample_01.roi-density.json
```

Repeat with sample 02 paths. The sample configurations use normalized video coordinates and retain 10 seconds / 10 seconds / 5 FPS defaults. The current demo outputs contain two complete windows plus one actual partial interval each:

| Demo | Duration | Window 0–10s avg / peak | Window 10–20s avg / peak | Tail | Status |
|---|---:|---:|---:|---:|---|
| 01 | 23.023s | 2.6875 / 5 | 3.6257 / 6 | 20–23.023s partial | Uncalibrated |
| 02 | 26s | 6.86 / 12 | 7.32 / 14 | 20–26s partial | Uncalibrated |

These are per-frame YOLOX vehicle detections in the selected image areas, not distinct vehicles, real Banda Aceh measurements, traffic flow, smp/hour, V/C, or MKJI level of service. The UI therefore labels them `EXPERIMENTAL — DEMO VIDEO`, and conditions remain unavailable until camera-specific density cutoffs are configured. Experimental cutoffs are not official or universal standards.

The V/C calculation remains separate in `apps/web/src/domain/trafficCalculation.ts`. It requires valid flow and a road-capacity configuration; ROI presence must never be converted to vehicles/hour or compared directly to smp/hour capacity.

CCTV ROI settings are stored in `public.cctv_analysis_config` by migration `20261106000100`. The editor exports JSON for reproducible offline processing; changing an ROI increments its database configuration version and marks prior output stale. `VITE_SUPABASE_ROI_DENSITY_ENABLED` stays false until this migration receives separate hosted deployment approval. The editor currently accepts the application's two approved browser-playable demo sources; private stream credentials/URLs are not exposed or fetched by this pipeline.
