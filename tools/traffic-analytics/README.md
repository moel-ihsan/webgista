# Offline traffic video analysis

This local batch tool runs OpenCV Zoo YOLOX-S COCO with OpenCV DNN. It records repeated detection instances, experimental tracker IDs, and virtual-line crossing events as separate measurements. It does not run in Vercel, infer live CCTV, or write traffic observations.

## Setup and processing

```sh
python3 -m venv .venv-traffic
. .venv-traffic/bin/activate
python -m pip install -r tools/traffic-analytics/requirements.txt
curl -L 'https://huggingface.co/opencv/object_detection_yolox/resolve/main/object_detection_yolox_2022nov_int8.onnx' -o /tmp/yolox.onnx
```

Keep model weights and source clips out of the repository. The following per-video settings reproduce the current site demos (the videos are the checked-in, licensed 1280×720 source assets):

```sh
python tools/traffic-analytics/analyze_video.py apps/web/public/traffic-demo/traffic_sample_01.mp4 --model /tmp/yolox.onnx --json apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json --annotated apps/web/public/traffic-demo/traffic_sample_01_annotated.mp4 --source-reference 'Pexels: City Intersection with Traffic and Signals, SHOX ART; Pexels Free License' --sampled-fps 5 --confidence 0.35 --roi 0.55 0.48 0.44 0.43 --counting-line 0.74 0.55 0.74 0.9 --direction both --max-track-distance 35 --max-missed-frames 2

python tools/traffic-analytics/analyze_video.py apps/web/public/traffic-demo/traffic_sample_02.mp4 --model /tmp/yolox.onnx --json apps/web/src/data/traffic-demo/traffic_sample_02.analysis.json --annotated apps/web/public/traffic-demo/traffic_sample_02_annotated.mp4 --source-reference 'Pexels: Bustling Night Traffic at Ben Thanh Market, Media Dung; Pexels Free License' --sampled-fps 5 --confidence 0.35 --roi 0.02 0.4 0.96 0.58 --counting-line 0.52 0.42 0.52 0.96 --direction both --max-track-distance 35 --max-missed-frames 2
```

Each output JSON records its frame dimensions, model, source, sampling rate, confidence threshold, ROI, finite counting segment, direction, track summaries, detections, crossing timestamp/frame, and ground-truth status. Car maps to LV, motorcycle to MC, bus/truck to HV, bicycle remains explicit; people and unsupported COCO classes are excluded.

## Manual ground truth

The checked-in `ground_truth_template.csv` contains only a header; it deliberately has no fabricated labels. Review the unannotated source video, use the counting segment documented in the analysis JSON, and record each actual crossing once with a unique event ID, category (`LV`, `HV`, `MC`, `bicycle`), direction (`negative_to_positive` or `positive_to_negative` relative to the directed line), time in seconds, and source frame index. Keep this CSV with local evaluation artifacts unless the labels are authorized for publication.

Run one-to-one event matching at a half-second timestamp tolerance:

```sh
python tools/traffic-analytics/evaluate_ground_truth.py apps/web/src/data/traffic-demo/traffic_sample_01.analysis.json /path/to/labels.csv --tolerance-seconds 0.5
```

The evaluator reports TP/FP/FN, precision, recall, F1, absolute count error, and per-category errors only when labels exist. It matches same category and direction within the configured time tolerance. It does not calculate IDF1; track-identity ground truth would require a separate frame-by-frame identity annotation. With the current header-only template, no accuracy metric is available.

## Limits

Tracking is greedy same-class centroid association with linear velocity prediction, a distance gate, and a finite line intersection. It tolerates a configured number of missed samples and counts an allowed crossing at most once per tracker ID. I retained this small dependency-free tracker rather than add SORT/ByteTrack: without labeled tracks, a comparison would not establish that a heavier alternative is more accurate. Dense overlap, class flicker, prolonged occlusion, and perspective can still split or merge tracks. Track diagnostics (such as one-frame track share) describe output, not accuracy.

The clips are about 23 and 26 seconds, below the calculation module's minimum 30-second window. They have no manually validated crossing labels or camera-specific road capacity, so V/C and Traffic Condition remain unavailable. Do not loop the clips, extrapolate their crossings, or record them as Banda Aceh CCTV observations. See `docs/PHASE_3_VIDEO_ANALYTICS.md` for source/license and research-method notes.
