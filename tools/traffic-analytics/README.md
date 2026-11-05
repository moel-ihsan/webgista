# Offline traffic video demo

This is a local batch demo. It runs OpenCV Zoo YOLOX-S (COCO, Apache-2.0), emits a JSON detection record and an H.264 annotated preview. Optional same-class centroid tracking and virtual-line crossing counts are experimental heuristics; frame detections are not unique vehicles, and the tracker has no ground-truth accuracy claim. It does not estimate traffic condition. Output is labeled as demo video and must not be inserted as live CCTV data.

## Setup

```sh
python3 -m venv .venv-traffic
. .venv-traffic/bin/activate
python -m pip install -r tools/traffic-analytics/requirements.txt
curl -L 'https://huggingface.co/opencv/object_detection_yolox/resolve/main/object_detection_yolox_2022nov_int8.onnx' -o /tmp/yolox.onnx
```

Keep the downloaded model and sample clips out of the public repository. OpenCV Zoo model card and model license are linked in `docs/PHASE_3_VIDEO_ANALYTICS.md`.

```sh
python tools/traffic-analytics/analyze_video.py /path/to/authorized.mp4 \
  --model /tmp/yolox.onnx \
  --json /tmp/analysis.json \
  --annotated /tmp/annotated.mp4 \
  --source-reference 'creator/source, license, permission' \
  --sampled-fps 5 --roi 0.1 0.3 0.8 0.6 --counting-line 0.5 0.3 0.5 0.9
```

ROI and line values use normalized frame coordinates. The tracker uses same-class greedy nearest centroids, a default 120 px movement limit, and a two-sample missed-frame allowance. A configured track contributes at most one line-crossing event during that run. This is useful for a reproducible demo, not validated unique-vehicle flow or an MKJI traffic category.

The required `source-reference` is provenance metadata. Do not include private stream URLs, credentials, or user data.
