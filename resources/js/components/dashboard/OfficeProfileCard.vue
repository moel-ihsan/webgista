<template>
  <div>
    <el-card :body-style="{ padding: '0px' }" class="cardOffice">
      <div class="imgBox">
        <img class="imgCont" :src="avatarSrc" />
      </div>
      <div style="padding-top: 14px">
        <div class="officeName">{{ users.name }}</div>
        <div class="officeAddress">{{ users.address }}</div>
        <div class="officeCoordinate">{{ users.longitude }} E {{ users.lattitude }} N</div>
        <div class="officeDesc">{{ users.description }}</div>
        <div class="recent">
          Recently Updated
          <el-row :gutter="10" class="recentRow">
            <RecentCctvCarousel />
          </el-row>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { resolveProfileImagePath } from "../../utils/formatters";
import RecentCctvCarousel from "./RecentCctvCarousel.vue";

export default {
  name: "OfficeProfileCard",
  components: {
    RecentCctvCarousel
  },
  props: {
    users: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    avatarSrc() {
      return resolveProfileImagePath(this.users && this.users.profile_photo_path);
    }
  }
};
</script>

<style>
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

.imgBox:hover .imgCont {
  transform: scale(1.25);
}

.officeName {
  font-size: var(--size-md);
  font-weight: 500;
  color: var(--text-color);
}

.officeAddress {
  font-size: var(--size-xs);
  color: var(--text-color);
}

.officeCoordinate {
  font-size: var(--size-xs);
  color: var(--green-theme);
  margin-bottom: 1.5em;
}

.officeDesc {
  font-size: var(--size-xs);
  color: var(--text-color);
  line-height: 1.5;
}

.recent {
  color: var(--text-color);
  font-size: var(--size-md);
  margin-top: 1.5em;
}

@media screen and (max-width: 992px) {
  .cardOffice {
    margin-top: 30px;
  }
}
</style>
