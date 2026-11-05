# Offline traffic video demo

This is a local batch demo. It runs OpenCV Zoo YOLOX-S (COCO, Apache-2.0) on one frame per second, emits a JSON detection record and an H.264 annotated preview. It performs **frame detections only**: counts are per sampled frame, not unique vehicles; there is no tracker and no traffic-condition estimator. Output is labeled as demo video and must not be inserted as live CCTV data.

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
  --source-reference 'creator/source, license, permission'
```

The required `source-reference` is provenance metadata. Do not include private stream URLs, credentials, or user data.
