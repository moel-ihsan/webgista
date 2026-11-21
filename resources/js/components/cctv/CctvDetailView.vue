<template>
  <div class="detail-grid-layout">
    <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
      <video
        v-if="videoSrc && !videoFailed"
        class="videoCCTV"
        controls
        autoplay
        muted
        loop
        playsinline
        :aria-label="`Video streaming CCTV ${cctv.name}`"
        @error="onVideoError"
      >
        <source :src="videoSrc" type="video/mp4" @error="onVideoError" />
      </video>
      <img
        v-else
        :src="thumbnailSrc"
        :alt="`Tangkapan kamera ${cctv.name}`"
        class="detail-regular-image"
      />
    </el-card>

    <el-card :body-style="{ padding: '0px' }" class="cardOffice detail-info-card">
      <div class="imgBox cctvThumbnail">
        <img class="imgCont" :src="thumbnailSrc" :alt="`Pratinjau ${cctv.name}`" />
        <div class="cctvStatus">
          <span
            class="detail-category-badge"
            :class="
              cctv.category === 'Regular'
                ? 'detail-category-badge--regular'
                : 'detail-category-badge--analytic'
            "
          >
            {{ cctv.category }}
          </span>
        </div>
      </div>

      <div class="detail-meta-block">
        <h2 class="cctvName">{{ cctv.name }}</h2>
        <div class="cctvAddress">{{ cctv.address }}</div>
        <div class="cctvCoordinate">{{ cctv.longitude }} E {{ cctv.lattitude }} N</div>
        <div class="cctvAgency">{{ cctv.agency }} Agent</div>
      </div>

      <div class="detail-map-box">
        <CoordinatePickerMap
          :latitude="cctv.lattitude"
          :longitude="cctv.longitude"
          :zoom="16"
          :interactive="false"
        />
      </div>

      <div class="btn-form-submit back-btn">
        <a
          v-if="cctv.category === 'Analytic'"
          :href="'/detail/video/' + cctv.id"
          class="detail-action-btn detail-action-btn--primary detail-detect-link"
        >
          Detection View
        </a>
        <button
          type="button"
          class="detail-action-btn detail-action-btn--secondary"
          @click="handleCancel"
        >
          Back
        </button>
      </div>
    </el-card>
  </div>
</template>

<script>
import { resolveCameraSimulation } from "../../config/simulation";
import CoordinatePickerMap from "../map/CoordinatePickerMap.vue";
import { resolveCctvImagePath } from "../../utils/formatters";

export default {
  name: "CctvDetailView",
  components: {
    CoordinatePickerMap
  },
  props: {
    cctv: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      videoFailed: false
    };
  },
  computed: {
    thumbnailSrc() {
      return resolveCctvImagePath(this.cctv.path_image);
    },
    videoSrc() {
      if (this.cctv && this.cctv.url) {
        return this.cctv.url;
      }
      if (this.cctv && this.cctv.category === "Analytic") {
        return resolveCameraSimulation(this.cctv).videoUrl;
      }
      return "";
    }
  },
  watch: {
    videoSrc() {
      this.videoFailed = false;
    }
  },
  methods: {
    onVideoError() {
      this.videoFailed = true;
    },
    handleCancel() {
      window.history.back();
    }
  }
};
</script>

<style>
.detail-grid-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

.cardVideoCCTV {
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background-color: #0f172a;
  aspect-ratio: 16 / 9;
  width: 100%;
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-card);
}

.videoCCTV,
.detail-regular-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.45s ease;
}

.cardVideoCCTV:hover .detail-regular-image {
  transform: scale(1.06);
}

.detail-info-card {
  background-color: var(--bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.cctvThumbnail {
  position: relative;
}

.cctvStatus {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.detail-category-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: 700;
  box-shadow: var(--shadow-card);
}

.detail-category-badge--analytic {
  background-color: var(--accent-soft-bg);
  color: var(--accent-soft-text);
  border: 1px solid var(--accent-soft-border);
}

.detail-category-badge--regular {
  background-color: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.detail-meta-block {
  padding-top: var(--space-4);
}

.cctvName {
  margin: 0 0 4px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.cctvAddress,
.cctvAgency {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.cctvCoordinate {
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--accent-primary);
  margin: 6px 0;
}

.detail-map-box {
  margin-top: var(--space-4);
  height: 210px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  position: relative;
}

.detail-map-box > div,
.detail-map-box #map {
  width: 100%;
  height: 100%;
}

.back-btn {
  margin-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.detail-action-btn {
  flex: 1;
  min-width: 130px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
}

.detail-action-btn--primary {
  background-color: var(--accent-primary);
  color: var(--accent-on-fill);
}

.detail-action-btn--primary:hover {
  background-color: var(--accent-primary-hover);
  color: var(--accent-on-fill);
}

.detail-action-btn--secondary {
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  border-color: var(--border-input);
}

.detail-action-btn--secondary:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

@media screen and (max-width: 1023px) {
  .detail-grid-layout {
    grid-template-columns: 1fr;
  }
}
</style>
