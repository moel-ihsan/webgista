<template>
  <div>
    <el-row :gutter="30">
      <el-col :span="15" :xs="24" :md="24" :lg="15">
        <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
          <video v-if="cctv.category === 'Analytic'" class="videoCCTV" controls autoplay>
            <source :src="cctv.url" type="video/mp4" />
          </video>
          <div v-if="cctv.category === 'Regular'" class="cardVideoCCTV">
            <img :src="thumbnailSrc" height="100%" width="100%" style="object-fit: cover" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="9" :xs="24" :md="24" :lg="9">
        <el-card :body-style="{ padding: '0px' }" class="cardOffice">
          <div class="imgBox cctvThumbnail">
            <img class="imgCont" :src="thumbnailSrc" />
            <div class="cctvStatus">
              <el-tag
                :type="cctv.category === 'Regular' ? 'primary' : 'success'"
                disable-transitions
              >
                {{ cctv.category }}
              </el-tag>
            </div>
          </div>
          <div style="padding-top: 14px">
            <div class="cctvName">{{ cctv.name }}</div>
            <div class="cctvAddress">{{ cctv.address }}</div>
            <div class="cctvCoordinate">{{ cctv.longitude }} E {{ cctv.lattitude }} N</div>
            <div class="cctvAgency">{{ cctv.agency }} Agent</div>
          </div>
          <div class="imgBox mapBox" style="margin-top: 20px">
            <CoordinatePickerMap
              :latitude="cctv.lattitude"
              :longitude="cctv.longitude"
              :zoom="16"
              :interactive="false"
            />
          </div>
          <div class="btn-form-submit back-btn">
            <el-button type="info" @click="handleCancel">Back</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
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
  computed: {
    thumbnailSrc() {
      return resolveCctvImagePath(this.cctv.path_image);
    }
  },
  methods: {
    handleCancel() {
      window.history.back();
    }
  }
};
</script>

<style>
.cardVideoCCTV {
  border-radius: 10px;
  border: none;
  height: 550px;
  overflow: hidden;
  position: relative;
  margin-bottom: 50px;
  transition: all 0.5s ease;
}

.is-always-shadow {
  border: none;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
}

.videoCCTV {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  z-index: 10;
  transition: all 0.5s ease;
}

.cardOffice {
  background-color: var(--color-secondary);
  padding: 15px;
  border-radius: 10px;
  border: none;
  overflow: hidden;
  position: relative;
  cursor: default;
  transition: all 0.5s ease;
}

.imgBox {
  border-radius: 10px;
  border: none;
  height: 200px;
  overflow: hidden;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  position: relative;
  transition: all 0.5s ease;
}

.imgBox.cctvThumbnail {
  height: 150px;
}

.imgBox.cctvThumbnail:before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0.5;
  height: 50%;
  width: 100%;
  z-index: 1;
  background: linear-gradient(45deg, rgba(13, 13, 13, 0) 0%, rgba(7, 7, 7, 1) 100%);
  mix-blend-mode: multiply;
  transition: all 0.5s ease;
}

.imgBox:hover.cctvThumbnail:before {
  opacity: 0.8;
}

.imgBox .imgCont {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  transition: all 0.5s ease;
}

.imgBox:hover {
  transform: scale(0.98);
  z-index: 1;
}

.imgBox.mapBox:hover {
  transform: none;
  z-index: 1;
}

.imgBox.mapBox {
  height: 200px;
}

.imgBox:hover .imgCont {
  transform: scale(1.25);
}

.cctvName {
  font-size: var(--size-md);
  color: var(--text-color);
  font-weight: 500;
}

.cctvAddress {
  font-size: var(--size-xs);
  color: var(--text-color);
}

.cctvCoordinate {
  font-size: var(--size-xs);
  color: var(--green-theme);
}

.cctvAgency {
  font-size: var(--size-xs);
  color: var(--text-color);
}

.cctvStatus {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
}

.btn-form-submit.back-btn .el-button {
  width: 100%;
}
</style>
