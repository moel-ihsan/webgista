<template>
  <div>
    <el-row :gutter="30" style="margin-top: 20px">
      <el-col :span="15" :xs="24" :md="24" :lg="15">
        <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
          <video
            id="my-video"
            ref="videoEl"
            :class="
              host === 'www.youtube.com'
                ? 'video-js vjs-default-skin vjs-big-play-centered videoCCTV'
                : 'videoCCTV'
            "
            preload="auto"
            autoplay
            muted
            loop
            playsinline
            crossorigin="anonymous"
            style="display: none"
          >
            <source
              v-if="host === 'www.youtube.com'"
              :src="resolvedVideoUrl"
              type="video/youtube"
            />
            <source v-else-if="resolvedVideoUrl" :src="resolvedVideoUrl" type="video/mp4" />
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

          <button
            v-if="resolvedPrecomputedUrl"
            id="btn-mode"
            type="button"
            class="el-button el-button--primary"
            @click="toggleDetectionMode"
          >
            {{ modeToggleLabel }}
          </button>
        </div>

        <canvas id="canvasw" ref="canvasw" class="canvasw" @mousedown="handleRoiCanvasClick" />
      </el-col>
      <el-col :span="9" :xs="24" :md="24" :lg="9">
        <el-row :gutter="30" style="padding-left: 15px; padding-right: 15px; margin-bottom: 20px">
          <el-col :span="16" :xs="16">
            <p style="margin-bottom: 4px">{{ cctv.name }}</p>
            <div id="detector-mode-status" class="detector-mode-meta">{{ detectorStatusText }}</div>
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
import { getSimulationConfig, resolveCameraSimulation } from "../../config/simulation";
import { updateRoi, updateTrafficCondition } from "../../services/api/cctvApi";
import { loadCocoSsdModel } from "../../services/traffic/cocoSsdLoader";
import { ANALYSIS_WINDOW_SECONDS } from "../../services/traffic/ihcmClassifier";
import {
  fetchPrecomputedDetections,
  getSynchronizedDetections
} from "../../services/traffic/precomputedPlayer";
import {
  drawRoiPolygon,
  extractRoiPoints,
  isValidRoi,
  serializeRoiPoints
} from "../../services/traffic/roiGeometry";
import { TrafficWindowTracker } from "../../services/traffic/windowTracker";
import TrafficCounterCards from "./TrafficCounterCards.vue";

const LIVE_DETECTION_INTERVAL_MS = 400;
const MODEL_LOAD_TIMEOUT_MS = 25000;

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
    const simulationConfig = getSimulationConfig();
    const cameraSimulation = resolveCameraSimulation(this.cctv, simulationConfig);

    return {
      oriVideo: true,
      areaVideo: true,
      themeSetting: true,
      host: "",
      simulationConfig,
      cameraSimulation,
      activeMode: simulationConfig.defaultMode || "live",
      model: null,
      precomputedPayload: null,
      lastPrecomputedFrameTime: null,
      lastDetectAtMs: 0,
      lastMatchedDetections: [],
      detectorStatusText: "Memuat detektor...",
      roiPoints: [],
      draftRoiPoints: [],
      counts: { lv: 0, hv: 0, mc: 0 },
      conditionLabel: "No Data",
      tracker: new TrafficWindowTracker(ANALYSIS_WINDOW_SECONDS),
      isDetecting: false,
      isDestroyed: false
    };
  },
  computed: {
    resolvedVideoUrl() {
      return (this.cctv && this.cctv.url) || this.cameraSimulation.videoUrl || "";
    },
    resolvedPrecomputedUrl() {
      return this.cameraSimulation.precomputedUrl || "";
    },
    modeToggleLabel() {
      return this.activeMode === "live" ? "Ganti ke Pra-hitung (JSON)" : "Ganti ke Live TF.js";
    }
  },
  created() {
    const dbRoi = extractRoiPoints(this.cctv);
    this.roiPoints =
      dbRoi.length === 5 ? dbRoi : extractRoiPoints(this.cameraSimulation.defaultRoi);
    if (this.cctv && this.cctv.keterangan) {
      this.conditionLabel = this.cctv.keterangan;
    }
    this.parseUrl();
  },
  mounted() {
    this.setupVideoDetection();
  },
  beforeDestroy() {
    this.isDestroyed = true;
    const video = this.$refs.videoEl;
    if (video) {
      video.removeEventListener("loadeddata", this.onVideoLoaded);
      video.removeEventListener("timeupdate", this.onVideoTimeUpdate);
    }
  },
  methods: {
    parseUrl() {
      if (!this.resolvedVideoUrl) {
        this.host = "";
        return;
      }

      try {
        const parsed = new URL(this.resolvedVideoUrl, window.location.origin);
        this.host = parsed.hostname;
      } catch (_err) {
        this.host = "";
      }
    },
    manageVideo() {
      const { canvasw, videoEl } = this.$refs;
      if (!canvasw) {
        return;
      }

      if (this.areaVideo === true) {
        this.draftRoiPoints = [];
        canvasw.style.display = "block";
        this.areaVideo = false;

        const ctw = canvasw.getContext("2d");
        if (ctw && videoEl && videoEl.videoWidth) {
          ctw.clearRect(0, 0, canvasw.width, canvasw.height);
          ctw.drawImage(videoEl, 0, 0, canvasw.width, canvasw.height);
        }
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
      this.renderCanvasOverlays();

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
    async toggleDetectionMode() {
      this.tracker.reset();
      this.counts = { lv: 0, hv: 0, mc: 0 };
      this.lastPrecomputedFrameTime = null;
      this.lastDetectAtMs = 0;
      this.lastMatchedDetections = [];

      if (this.activeMode === "live") {
        this.activeMode = "precomputed";
        await this.ensurePrecomputedLoaded();
      } else {
        this.activeMode = "live";
        await this.ensureLiveModelLoaded();
      }

      this.renderCanvasOverlays();
      this.runCurrentModeStep(true);
    },
    setupVideoDetection() {
      const video = this.$refs.videoEl;
      if (!video) {
        return;
      }

      video.addEventListener("loadeddata", this.onVideoLoaded);
      video.addEventListener("timeupdate", this.onVideoTimeUpdate);

      if (video.readyState >= 2) {
        this.onVideoLoaded();
      }
    },
    async onVideoLoaded() {
      const { videoEl, canvasv, canvasx, canvasy, canvasw } = this.$refs;
      if (!videoEl || !canvasv || !canvasx || !canvasy || !canvasw) {
        return;
      }

      const targetW = videoEl.videoWidth || 640;
      const targetH = videoEl.videoHeight || 360;
      [canvasv, canvasx, canvasy, canvasw].forEach((canvas) => {
        canvas.width = targetW;
        canvas.height = targetH;
      });

      const ctv = canvasv.getContext("2d");
      if (ctv) {
        ctv.save();
      }

      this.drawVideoFrameToCanvases();
      this.renderCanvasOverlays();

      if (typeof videoEl.play === "function") {
        videoEl.play().catch(() => {});
      }

      if (this.activeMode === "precomputed") {
        await this.ensurePrecomputedLoaded();
      } else {
        await this.ensureLiveModelLoaded();
      }

      if (!this.isDestroyed) {
        this.runCurrentModeStep(true);
      }
    },
    async ensureLiveModelLoaded() {
      if (this.model) {
        this.detectorStatusText = "Mode: Live TF.js (COCO-SSD di browser)";
        return true;
      }

      this.detectorStatusText = "Memuat model COCO-SSD di browser...";

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("COCO-SSD load timeout")), MODEL_LOAD_TIMEOUT_MS);
        });
        this.model = await Promise.race([loadCocoSsdModel(), timeoutPromise]);
        if (!this.isDestroyed && this.activeMode === "live") {
          this.detectorStatusText = "Mode: Live TF.js (COCO-SSD di browser)";
        }
        return true;
      } catch (_err) {
        this.model = null;
        if (!this.isDestroyed && this.resolvedPrecomputedUrl) {
          this.activeMode = "precomputed";
          await this.ensurePrecomputedLoaded("otomatis fallback");
        } else if (!this.isDestroyed) {
          this.detectorStatusText = "Model TF.js gagal dimuat";
        }
        return false;
      }
    },
    async ensurePrecomputedLoaded(reason = "") {
      if (this.precomputedPayload) {
        this.detectorStatusText = reason
          ? `Mode: Pra-hitung JSON (${reason})`
          : "Mode: Pra-hitung JSON (sinkron video)";
        return true;
      }

      if (!this.resolvedPrecomputedUrl) {
        this.detectorStatusText = "Data pra-hitung JSON tidak tersedia";
        return false;
      }

      this.detectorStatusText = "Memuat data pra-hitung JSON...";
      try {
        this.precomputedPayload = await fetchPrecomputedDetections(this.resolvedPrecomputedUrl);
        if (!this.isDestroyed) {
          this.detectorStatusText = reason
            ? `Mode: Pra-hitung JSON (${reason})`
            : "Mode: Pra-hitung JSON (sinkron video)";
        }
        return true;
      } catch (_err) {
        if (!this.isDestroyed) {
          this.detectorStatusText = "Gagal memuat data pra-hitung JSON";
        }
        return false;
      }
    },
    drawVideoFrameToCanvases() {
      const { videoEl, canvasv, canvasy, canvasw } = this.$refs;
      if (!videoEl || !canvasv || !canvasy || !canvasw || videoEl.readyState < 2) {
        return;
      }

      const ctv = canvasv.getContext("2d");
      const cty = canvasy.getContext("2d");
      const ctw = canvasw.getContext("2d");
      if (!ctv || !cty || !ctw) {
        return;
      }

      cty.drawImage(videoEl, 0, 0, canvasy.width, canvasy.height);

      ctv.restore();
      ctv.save();
      ctv.clearRect(0, 0, canvasv.width, canvasv.height);
      if (isValidRoi(this.roiPoints)) {
        drawRoiPolygon(ctv, this.roiPoints, { clip: true });
      }
      ctv.drawImage(videoEl, 0, 0, canvasv.width, canvasv.height);

      if (!this.areaVideo) {
        ctw.drawImage(videoEl, 0, 0, canvasw.width, canvasw.height);
      }
    },
    renderCanvasOverlays() {
      const canvasx = this.$refs.canvasx;
      if (!canvasx) {
        return;
      }

      const ctx = canvasx.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.clearRect(0, 0, canvasx.width, canvasx.height);

      if (isValidRoi(this.roiPoints)) {
        drawRoiPolygon(ctx, this.roiPoints, { strokeStyle: "blue", lineWidth: 5 });
      }

      this.lastMatchedDetections.forEach((det) => {
        if (!det || !Array.isArray(det.bbox) || det.bbox.length < 4) {
          return;
        }
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "red";
        ctx.rect(...det.bbox);
        ctx.stroke();
        ctx.closePath();
      });
    },
    applyDetectionResults(results, currentTime) {
      const step = this.tracker.recordCapture(results, currentTime);
      this.counts = step.counts;
      this.conditionLabel = step.classification.label;
      this.lastMatchedDetections = step.frameCounts.matchedDetections;
      this.renderCanvasOverlays();

      if (step.shouldPersist && this.cctv && this.cctv.id) {
        updateTrafficCondition(this.cctv.id, step.classification.label).catch(() => {});
      }
    },
    onVideoTimeUpdate() {
      this.drawVideoFrameToCanvases();
      this.runCurrentModeStep(false);
    },
    runCurrentModeStep(forceImmediate) {
      const { videoEl, canvasv } = this.$refs;
      if (!videoEl || !canvasv || videoEl.readyState < 2) {
        return;
      }

      const currentTime = Number(videoEl.currentTime || 0);

      if (this.activeMode === "precomputed") {
        if (!this.precomputedPayload) {
          return;
        }
        const synced = getSynchronizedDetections(
          this.precomputedPayload,
          currentTime,
          { width: canvasv.width, height: canvasv.height },
          this.roiPoints
        );
        if (forceImmediate || synced.frameTime !== this.lastPrecomputedFrameTime) {
          this.lastPrecomputedFrameTime = synced.frameTime;
          this.applyDetectionResults(synced.detections, currentTime);
        }
        return;
      }

      if (!this.model || this.isDetecting) {
        return;
      }

      const now = performance.now();
      if (!forceImmediate && now - this.lastDetectAtMs < LIVE_DETECTION_INTERVAL_MS) {
        return;
      }

      this.lastDetectAtMs = now;
      this.isDetecting = true;

      this.model
        .detect(canvasv)
        .then((results) => {
          if (!this.isDestroyed && this.activeMode === "live") {
            this.applyDetectionResults(results, Number(videoEl.currentTime || 0));
          }
        })
        .catch(() => {})
        .finally(() => {
          this.isDetecting = false;
        });
    }
  }
};
</script>

<style>
.btn-video {
  margin-top: -20px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detector-mode-meta {
  font-size: var(--size-xs);
  color: var(--green-theme);
  font-weight: 500;
}

.canvasw {
  background-color: var(--color-secondary);
  display: none;
  border-radius: 10px;
  width: 100%;
  height: auto;
}
</style>
