<template>
  <div class="video-detector-layout">
    <div class="video-detector-primary">
      <div class="detector-video-card">
        <video
          id="my-video"
          ref="videoEl"
          :class="
            host === 'www.youtube.com'
              ? 'video-js vjs-default-skin vjs-big-play-centered detector-layer-media'
              : 'detector-layer-media'
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
          class="detector-layer-media"
          :class="{ 'roi-editing': !areaVideo }"
          style="display: block; z-index: 12"
          @mousedown="handleRoiCanvasClick"
        />
        <canvas
          id="canvasv"
          ref="canvasv"
          class="detector-layer-media"
          style="display: block; background-color: rgba(0, 0, 0, 0); z-index: 11"
        />
        <canvas
          id="canvasy"
          ref="canvasy"
          class="detector-layer-media"
          style="display: block; z-index: 10"
        />
      </div>

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
        <template v-else>
          <button
            id="btn-drop"
            type="button"
            class="el-button el-button--primary"
            @click="manageVideo"
          >
            Done
          </button>
          <button
            id="btn-undo-roi"
            type="button"
            class="el-button el-button--warning"
            :disabled="draftRoiPoints.length === 0"
            @click="undoLastDraftPoint"
          >
            Undo Titik
          </button>
          <button
            id="btn-reset-roi"
            type="button"
            class="el-button el-button--info"
            @click="resetDraftRoi"
          >
            Reset Titik
          </button>
          <button
            id="btn-cancel-roi"
            type="button"
            class="el-button el-button--info"
            @click="cancelEditRoi"
          >
            Batal
          </button>
        </template>

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

      <div v-if="!areaVideo" id="roi-edit-hint" class="roi-edit-hint" role="status">
        Mode Edit Area Deteksi: Klik bebas titik pada video untuk membentuk poligon (minimal 3
        titik, saat ini {{ draftRoiPoints.length }} titik), lalu klik Done.
      </div>

      <canvas id="canvasw" ref="canvasw" class="canvasw" />
    </div>

    <div class="video-detector-sidebar">
      <div class="detector-summary-card">
        <h2 class="detector-cctv-heading">{{ cctv.name }}</h2>
        <div id="detector-mode-status" class="detector-mode-meta">{{ detectorStatusText }}</div>
        <div id="detector-sync-status" class="detector-sync-meta">{{ syncStatusText }}</div>
      </div>

      <el-form class="veh-form" :model="cctv">
        <TrafficCounterCards
          :lv-count="counts.lv"
          :hv-count="counts.hv"
          :mc-count="counts.mc"
          :condition-label="conditionLabel"
        />
      </el-form>
    </div>
  </div>
</template>

<script>
import { getSimulationConfig, resolveCameraSimulation } from "../../config/simulation";
import { fetchAuthUser } from "../../services/api/authApi";
import { updateRoi, updateTrafficCondition } from "../../services/api/cctvApi";
import { loadCocoSsdModel } from "../../services/traffic/cocoSsdLoader";
import { ANALYSIS_WINDOW_SECONDS } from "../../services/traffic/ihcmClassifier";
import {
  fetchPrecomputedDetections,
  getSynchronizedDetections
} from "../../services/traffic/precomputedPlayer";
import {
  MIN_ROI_POINTS,
  drawRoiPolygon,
  extractRoiPoints,
  isValidRoi,
  mapClientPointToCanvas,
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
      isDestroyed: false,
      isAdmin: false,
      lastPersistedCondition: null,
      hasComputedDetection: false,
      pendingWindowSync: false
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
    },
    syncStatusText() {
      return this.isAdmin
        ? "Sinkronisasi status ke /map aktif (Admin)"
        : "Mode tamu — login admin untuk menyinkronkan warna marker ke /map";
    }
  },
  created() {
    const sessionRoi = this.readSessionRoi();
    const dbRoi = extractRoiPoints(this.cctv);
    if (isValidRoi(sessionRoi)) {
      this.roiPoints = sessionRoi;
    } else if (isValidRoi(dbRoi)) {
      this.roiPoints = dbRoi;
    } else {
      this.roiPoints = extractRoiPoints(this.cameraSimulation.defaultRoi);
    }

    if (this.cctv && this.cctv.keterangan) {
      this.conditionLabel = this.cctv.keterangan;
    }
    this.parseUrl();
    fetchAuthUser()
      .then((data) => {
        if (!this.isDestroyed) {
          this.isAdmin = Boolean(data && data.user && data.user.role === "admin");
          if (this.isAdmin && this.hasComputedDetection) {
            this.persistConditionIfAdmin(this.conditionLabel);
          }
        }
      })
      .catch(() => {});
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
    getRoiStorageKey() {
      return this.cctv && this.cctv.id ? `webgista_roi_${this.cctv.id}` : "";
    },
    readSessionRoi() {
      const key = this.getRoiStorageKey();
      if (!key || typeof sessionStorage === "undefined") {
        return [];
      }
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) {
          return [];
        }
        const parsed = JSON.parse(raw);
        return isValidRoi(parsed) ? parsed : [];
      } catch (_err) {
        return [];
      }
    },
    writeSessionRoi(points) {
      const key = this.getRoiStorageKey();
      if (!key || typeof sessionStorage === "undefined") {
        return;
      }
      try {
        sessionStorage.setItem(key, JSON.stringify(points));
      } catch (_err) {
        // Ignore storage quota errors
      }
    },
    clearSessionRoi() {
      const key = this.getRoiStorageKey();
      if (!key || typeof sessionStorage === "undefined") {
        return;
      }
      try {
        sessionStorage.removeItem(key);
      } catch (_err) {
        // Ignore storage errors
      }
    },
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
      if (this.areaVideo === true) {
        this.draftRoiPoints = [];
        this.areaVideo = false;
        this.renderCanvasOverlays();
        return;
      }

      if (this.draftRoiPoints.length === 0) {
        this.areaVideo = true;
        this.renderCanvasOverlays();
        return;
      }

      if (this.draftRoiPoints.length < MIN_ROI_POINTS) {
        this.$message({
          message: "Klik minimal 3 titik pada video untuk membentuk poligon (atau klik Batal).",
          type: "warning"
        });
        return;
      }

      if (!isValidRoi(this.draftRoiPoints)) {
        this.$message({
          message:
            "Titik belum membentuk poligon berluas valid (tidak boleh segaris). Tambahkan atau ubah posisi titik.",
          type: "warning"
        });
        return;
      }

      this.areaVideo = true;
      this.saveRoi(this.draftRoiPoints);
      this.draftRoiPoints = [];
    },
    undoLastDraftPoint() {
      if (this.draftRoiPoints.length > 0) {
        this.draftRoiPoints.pop();
        this.renderCanvasOverlays();
      }
    },
    resetDraftRoi() {
      this.draftRoiPoints = [];
      this.areaVideo = false;
      this.renderCanvasOverlays();
    },
    cancelEditRoi() {
      this.draftRoiPoints = [];
      this.areaVideo = true;
      this.renderCanvasOverlays();
    },
    saveRoi(points) {
      this.roiPoints = [...points];
      this.tracker.reset();
      this.counts = { lv: 0, hv: 0, mc: 0 };
      this.lastPersistedCondition = null;
      this.hasComputedDetection = false;
      this.pendingWindowSync = false;
      this.lastPrecomputedFrameTime = null;
      this.lastMatchedDetections = [];
      this.drawVideoFrameToCanvases();
      this.renderCanvasOverlays();
      this.runCurrentModeStep(true);

      if (this.isAdmin && this.cctv && this.cctv.id) {
        this.clearSessionRoi();
        updateRoi(this.cctv.id, serializeRoiPoints(points))
          .then(() => {
            this.$message({ message: "Area deteksi biru disimpan ke database.", type: "success" });
          })
          .catch(() => {
            this.$message({
              message: "Gagal menyimpan area deteksi ke database.",
              type: "error"
            });
          });
      } else {
        this.writeSessionRoi(points);
        this.$message({
          message:
            "Area deteksi biru diterapkan untuk sesi ini (login admin untuk simpan permanen).",
          type: "success"
        });
      }
    },
    handleRoiCanvasClick(event) {
      if (this.areaVideo) {
        return;
      }

      const canvasx = this.$refs.canvasx;
      if (!canvasx || !canvasx.width || !canvasx.height) {
        return;
      }

      const rect = canvasx.getBoundingClientRect();
      const computedStyle =
        typeof window !== "undefined" && typeof window.getComputedStyle === "function"
          ? window.getComputedStyle(canvasx)
          : null;
      const objectFit = (computedStyle && computedStyle.objectFit) || "fill";

      const point = mapClientPointToCanvas({
        clientX: event.clientX,
        clientY: event.clientY,
        rect,
        canvasWidth: canvasx.width,
        canvasHeight: canvasx.height,
        objectFit
      });

      this.draftRoiPoints.push(point);
      this.renderCanvasOverlays();
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
      this.lastPersistedCondition = null;
      this.hasComputedDetection = false;
      this.pendingWindowSync = false;
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
      if (!videoEl || !canvasv || !canvasx || !canvasy) {
        return;
      }

      const targetW = videoEl.videoWidth || 640;
      const targetH = videoEl.videoHeight || 360;
      [canvasv, canvasx, canvasy, canvasw].forEach((canvas) => {
        if (canvas) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
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
      const { videoEl, canvasv, canvasy } = this.$refs;
      if (!videoEl || !canvasv || !canvasy || videoEl.readyState < 2) {
        return;
      }

      const ctv = canvasv.getContext("2d");
      const cty = canvasy.getContext("2d");
      if (!ctv || !cty) {
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
    },
    drawDraftRoiPreview(ctx) {
      if (this.draftRoiPoints.length === 0) {
        if (isValidRoi(this.roiPoints)) {
          if (typeof ctx.save === "function") {
            ctx.save();
          }
          if (typeof ctx.setLineDash === "function") {
            ctx.setLineDash([8, 6]);
          }
          drawRoiPolygon(ctx, this.roiPoints, {
            strokeStyle: "rgba(0, 123, 255, 0.75)",
            lineWidth: 3
          });
          if (typeof ctx.restore === "function") {
            ctx.restore();
          }
        }
        return;
      }

      if (this.draftRoiPoints.length >= MIN_ROI_POINTS && isValidRoi(this.draftRoiPoints)) {
        ctx.beginPath();
        ctx.moveTo(this.draftRoiPoints[0].x, this.draftRoiPoints[0].y);
        for (let i = 1; i < this.draftRoiPoints.length; i += 1) {
          ctx.lineTo(this.draftRoiPoints[i].x, this.draftRoiPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0, 123, 255, 0.14)";
        ctx.fill();
      }

      if (this.draftRoiPoints.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(this.draftRoiPoints[0].x, this.draftRoiPoints[0].y);
        for (let i = 1; i < this.draftRoiPoints.length; i += 1) {
          ctx.lineTo(this.draftRoiPoints[i].x, this.draftRoiPoints[i].y);
        }
        ctx.lineWidth = 4;
        ctx.strokeStyle = "blue";
        ctx.stroke();
      }

      if (this.draftRoiPoints.length >= MIN_ROI_POINTS && isValidRoi(this.draftRoiPoints)) {
        const first = this.draftRoiPoints[0];
        const last = this.draftRoiPoints[this.draftRoiPoints.length - 1];
        if (typeof ctx.save === "function") {
          ctx.save();
        }
        if (typeof ctx.setLineDash === "function") {
          ctx.setLineDash([6, 6]);
        }
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(first.x, first.y);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0, 123, 255, 0.85)";
        ctx.stroke();
        if (typeof ctx.restore === "function") {
          ctx.restore();
        }
      }

      this.draftRoiPoints.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        if (typeof ctx.fillText === "function") {
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 10px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(idx + 1), pt.x, pt.y);
        }
      });
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

      if (!this.areaVideo) {
        this.drawDraftRoiPreview(ctx);
        return;
      }

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
    persistConditionIfAdmin(label) {
      if (
        !this.isAdmin ||
        !this.cctv ||
        !this.cctv.id ||
        !label ||
        label === "No Data" ||
        this.lastPersistedCondition === label
      ) {
        return;
      }

      this.lastPersistedCondition = label;
      updateTrafficCondition(this.cctv.id, label).catch(() => {
        if (!this.isDestroyed && this.lastPersistedCondition === label) {
          this.lastPersistedCondition = null;
        }
      });
    },
    applyDetectionResults(results, currentTime) {
      const step = this.tracker.recordCapture(results, currentTime);
      this.hasComputedDetection = true;
      if (step.windowReset) {
        this.pendingWindowSync = true;
      }
      this.counts = step.counts;
      this.conditionLabel = step.classification.label;
      this.lastMatchedDetections = step.frameCounts.matchedDetections;
      this.renderCanvasOverlays();

      const isEmptyLoopReset =
        step.windowReset && step.completedClassification !== null && step.frameCounts.total === 0;

      if (!isEmptyLoopReset && (step.shouldPersist || this.pendingWindowSync)) {
        this.pendingWindowSync = false;
        this.persistConditionIfAdmin(step.classification.label);
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
.video-detector-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.video-detector-primary,
.video-detector-sidebar {
  min-width: 0;
}

.detector-video-card {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background-color: #0f172a;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.detector-layer-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-video {
  margin-top: var(--space-3);
  margin-bottom: var(--space-3);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.roi-editing {
  cursor: crosshair;
}

.roi-edit-hint {
  margin-bottom: var(--space-4);
  padding: 10px 14px;
  border-radius: var(--radius-md);
  background-color: var(--bg-surface);
  border: 1px solid var(--accent-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.detector-summary-card {
  margin-bottom: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.detector-cctv-heading {
  margin: 0 0 6px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.detector-mode-meta {
  font-size: var(--text-sm);
  color: var(--accent-primary);
  font-weight: 600;
}

.detector-sync-meta {
  margin-top: 2px;
  font-size: var(--text-caption);
  color: var(--text-secondary);
}

.canvasw {
  background-color: var(--bg-surface);
  display: none;
  border-radius: var(--radius-md);
  width: 100%;
  height: auto;
}

@media screen and (max-width: 1023px) {
  .video-detector-layout {
    grid-template-columns: 1fr;
  }
}
</style>
