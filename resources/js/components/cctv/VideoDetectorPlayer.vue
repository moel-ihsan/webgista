<template>
  <div>
    <el-row :gutter="30" style="margin-top: 20px">
      <el-col :span="15" :xs="24" :md="24" :lg="15">
        <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
          <video
            id="my-video"
            ref="videoEl"
            class="video-js vjs-default-skin vjs-big-play-centered videoCCTV"
            preload="auto"
            autoplay
            controls
            data-setup="{}"
            style="display: none"
          >
            <source v-if="host === 'www.youtube.com'" :src="cctv.url" type="video/youtube" />
            <source v-else :src="cctv.url" type="video/mp4" />
          </video>
          <canvas
            id="canvasx"
            ref="canvasx"
            class="videoCCTV"
            style="display: block; z-index: 12"
          />
          <canvas
            id="canvasv"
            ref="canvasv"
            class="videoCCTV"
            style="display: block; background-color: rgba(0, 0, 0, 0); z-index: 11"
          />
          <canvas
            id="canvasy"
            ref="canvasy"
            class="videoCCTV"
            style="display: block; z-index: 10"
          />
        </el-card>
        <div class="btn-video">
          <button
            v-if="areaVideo === true"
            id="btn-manage"
            type="button"
            class="el-button el-button--primary"
            @click="manageVideo"
          >
            Manage Video
          </button>
          <button
            v-else
            id="btn-drop"
            type="button"
            class="el-button el-button--primary"
            @click="manageVideo"
          >
            Done
          </button>

          <button
            v-if="oriVideo === true"
            id="btn-show"
            type="button"
            class="el-button el-button--primary"
            @click="showVideo"
          >
            Show Video
          </button>
          <button
            v-else
            id="btn-hide"
            type="button"
            class="el-button el-button--primary"
            @click="showVideo"
          >
            Hide Video
          </button>
        </div>

        <canvas id="canvasw" ref="canvasw" class="canvasw" @mousedown="handleRoiCanvasClick" />
      </el-col>
      <el-col :span="9" :xs="24" :md="24" :lg="9">
        <el-row :gutter="30" style="padding-left: 15px; padding-right: 15px; margin-bottom: 20px">
          <el-col :span="16" :xs="16">
            <p>{{ cctv.name }}</p>
          </el-col>
          <el-col :span="8" :xs="8">
            <el-switch
              v-model="themeSetting"
              class="nav-right"
              active-color="white"
              inactive-color="#27293d"
            />
          </el-col>
        </el-row>
        <el-form class="veh-form" :model="cctv">
          <TrafficCounterCards
            :lv-count="counts.lv"
            :hv-count="counts.hv"
            :mc-count="counts.mc"
            :condition-label="conditionLabel"
          />
        </el-form>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import { updateRoi, updateTrafficCondition } from "../../services/api/cctvApi";
import { loadCocoSsdModel } from "../../services/traffic/cocoSsdLoader";
import { ANALYSIS_WINDOW_SECONDS } from "../../services/traffic/ihcmClassifier";
import {
  drawRoiPolygon,
  extractRoiPoints,
  isValidRoi,
  serializeRoiPoints
} from "../../services/traffic/roiGeometry";
import { TrafficWindowTracker } from "../../services/traffic/windowTracker";
import TrafficCounterCards from "./TrafficCounterCards.vue";

export default {
  name: "VideoDetectorPlayer",
  components: {
    TrafficCounterCards
  },
  props: {
    cctv: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      oriVideo: true,
      areaVideo: true,
      themeSetting: true,
      host: "",
      model: null,
      roiPoints: [],
      draftRoiPoints: [],
      counts: { lv: 0, hv: 0, mc: 0 },
      conditionLabel: "No Data",
      tracker: new TrafficWindowTracker(ANALYSIS_WINDOW_SECONDS),
      isDetecting: false
    };
  },
  created() {
    this.roiPoints = extractRoiPoints(this.cctv);
    if (this.cctv && this.cctv.keterangan) {
      this.conditionLabel = this.cctv.keterangan;
    }
    this.parseUrl();
  },
  mounted() {
    this.setupVideoDetection();
  },
  beforeDestroy() {
    const video = this.$refs.videoEl;
    if (video) {
      video.removeEventListener("loadeddata", this.onVideoLoaded);
      video.removeEventListener("timeupdate", this.onVideoTimeUpdate);
    }
  },
  methods: {
    parseUrl() {
      if (!this.cctv || !this.cctv.url) {
        this.host = "";
        return;
      }

      try {
        const parsed = new URL(this.cctv.url, window.location.origin);
        this.host = parsed.hostname;
      } catch (_err) {
        this.host = "";
      }
    },
    manageVideo() {
      const canvasw = this.$refs.canvasw;
      if (!canvasw) {
        return;
      }

      if (this.areaVideo === true) {
        this.draftRoiPoints = [];
        canvasw.style.display = "block";
        this.areaVideo = false;
      } else {
        canvasw.style.display = "none";
        this.areaVideo = true;
        if (this.draftRoiPoints.length === 5 && isValidRoi(this.draftRoiPoints)) {
          this.saveRoi(this.draftRoiPoints);
        }
      }
    },
    saveRoi(points) {
      this.roiPoints = [...points];
      this.applyRoiToCanvases();

      updateRoi(this.cctv.id, serializeRoiPoints(points))
        .then(() => {
          this.$message({ message: "Detection area saved", type: "success" });
        })
        .catch(() => {});
    },
    handleRoiCanvasClick(event) {
      if (this.areaVideo) {
        return;
      }

      const canvasw = this.$refs.canvasw;
      if (!canvasw || !canvasw.width || !canvasw.height) {
        return;
      }

      const rect = canvasw.getBoundingClientRect();
      const scaleX = canvasw.width / (rect.width || 1);
      const scaleY = canvasw.height / (rect.height || 1);
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;

      if (this.draftRoiPoints.length >= 5) {
        this.draftRoiPoints = [];
      }
      this.draftRoiPoints.push({ x, y });

      const ctw = canvasw.getContext("2d");
      if (ctw) {
        ctw.fillStyle = "blue";
        ctw.beginPath();
        ctw.arc(x, y, 5, 0, Math.PI * 2);
        ctw.fill();

        if (this.draftRoiPoints.length === 5 && isValidRoi(this.draftRoiPoints)) {
          drawRoiPolygon(ctw, this.draftRoiPoints, { strokeStyle: "blue", lineWidth: 5 });
        }
      }
    },
    showVideo() {
      const video = this.$refs.videoEl;
      if (!video) {
        return;
      }

      if (this.oriVideo === true) {
        video.style.display = "block";
        video.style.zIndex = "30";
        this.oriVideo = false;
      } else {
        video.style.display = "none";
        video.style.zIndex = "1";
        this.oriVideo = true;
      }
    },
    applyRoiToCanvases() {
      const { canvasv, canvasx } = this.$refs;
      if (!canvasv || !canvasx || !isValidRoi(this.roiPoints)) {
        return;
      }

      const ctv = canvasv.getContext("2d");
      const ctx = canvasx.getContext("2d");
      if (!ctv || !ctx) {
        return;
      }

      ctv.restore();
      ctv.save();
      drawRoiPolygon(ctv, this.roiPoints, { clip: true });
      drawRoiPolygon(ctv, this.roiPoints, { strokeStyle: "blue", lineWidth: 10 });

      ctx.clearRect(0, 0, canvasx.width, canvasx.height);
      drawRoiPolygon(ctx, this.roiPoints, { strokeStyle: "blue", lineWidth: 5 });
    },
    setupVideoDetection() {
      const video = this.$refs.videoEl;
      if (!video) {
        return;
      }

      video.addEventListener("loadeddata", this.onVideoLoaded);
      video.addEventListener("timeupdate", this.onVideoTimeUpdate);
    },
    async onVideoLoaded() {
      const { videoEl, canvasv, canvasx, canvasy, canvasw } = this.$refs;
      if (!videoEl || !canvasv || !canvasx || !canvasy || !canvasw) {
        return;
      }

      [canvasv, canvasx, canvasy, canvasw].forEach((canvas) => {
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
      });

      const ctv = canvasv.getContext("2d");
      if (ctv) {
        ctv.save();
      }
      this.applyRoiToCanvases();

      try {
        this.model = await loadCocoSsdModel();
      } catch (_err) {
        this.model = null;
      }
    },
    onVideoTimeUpdate() {
      const { videoEl, canvasv, canvasy, canvasw } = this.$refs;
      if (!videoEl || !canvasv || !canvasy || !canvasw) {
        return;
      }

      const ctv = canvasv.getContext("2d");
      const cty = canvasy.getContext("2d");
      const ctw = canvasw.getContext("2d");
      if (!ctv || !cty || !ctw) {
        return;
      }

      cty.drawImage(videoEl, 0, 0);
      ctv.drawImage(videoEl, 0, 0);
      ctw.drawImage(videoEl, 0, 0);

      if (!this.model || this.isDetecting) {
        return;
      }

      this.isDetecting = true;
      canvasv.toBlob((blob) => {
        if (!blob) {
          this.isDetecting = false;
          return;
        }

        const imgTag = document.createElement("img");
        const objectUrl = URL.createObjectURL(blob);
        imgTag.src = objectUrl;
        imgTag.onload = async () => {
          try {
            const results = await this.model.detect(imgTag);
            const step = this.tracker.recordCapture(results, videoEl.currentTime || 0);

            this.counts = step.counts;
            this.conditionLabel = step.classification.label;

            step.frameCounts.matchedDetections.forEach((det) => {
              ctv.beginPath();
              ctv.rect(...det.bbox);
              ctv.strokeStyle = "red";
              ctv.stroke();
              ctv.closePath();
            });

            if (step.shouldPersist && this.cctv && this.cctv.id) {
              updateTrafficCondition(this.cctv.id, step.classification.label).catch(() => {});
            }
          } finally {
            URL.revokeObjectURL(objectUrl);
            this.isDetecting = false;
          }
        };
        imgTag.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          this.isDetecting = false;
        };
      }, "image/jpeg");
    }
  }
};
</script>

<style>
.btn-video {
  margin-top: -20px;
  margin-bottom: 20px;
}

.canvasw {
  background-color: var(--color-secondary);
  display: none;
  border-radius: 10px;
}
</style>
