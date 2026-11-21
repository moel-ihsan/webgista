<template>
  <el-card :body-style="{ padding: '0px' }" class="cardOffice">
    <div class="imgBox">
      <img
        class="imgCont"
        :src="avatarSrc"
        :alt="users.name ? `Foto instansi ${users.name}` : 'Foto instansi pengelola'"
      />
    </div>
    <div class="officeContent">
      <h2 class="officeName">{{ users.name }}</h2>
      <div class="officeAddress">{{ users.address }}</div>
      <div class="officeCoordinate">{{ users.longitude }} E {{ users.lattitude }} N</div>
      <p class="officeDesc">{{ users.description }}</p>
      <div class="recent">
        <h3 class="recentTitle">Recently Updated</h3>
        <RecentCctvCarousel />
      </div>
    </div>
  </el-card>
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
  background-color: var(--bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
}

.imgBox {
  border-radius: var(--radius-md);
  height: 200px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  position: relative;
  background-color: var(--bg-surface-subtle);
}

.imgBox .imgCont {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.officeContent {
  padding-top: var(--space-4);
}

.officeName {
  margin: 0 0 4px;
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--text-primary);
}

.officeAddress {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.officeCoordinate {
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--accent-primary);
  margin: 6px 0 14px;
}

.officeDesc {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.recent {
  margin-top: var(--space-5);
}

.recentTitle {
  margin: 0 0 8px;
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
}

@media screen and (max-width: 992px) {
  .cardOffice {
    margin-top: var(--space-4);
  }
}
</style>
