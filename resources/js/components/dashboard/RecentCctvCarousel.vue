<template>
  <div>
    <flickity ref="flickity" :options="flickityOptions">
      <div v-for="item in items" :key="item.id">
        <a :href="'/detail/' + item.id">
          <div class="carousel-cell">
            <el-card :body-style="{ padding: '0px' }" style="background: transparent">
              <img :src="item.imageUrl" class="imageRecent" />
              <div class="contentRecent">
                <div class="nameRecent">{{ item.name }}</div>
                <div class="timeRecent">{{ item.time }}</div>
              </div>
            </el-card>
          </div>
        </a>
      </div>
    </flickity>
  </div>
</template>

<script>
import Flickity from "vue-flickity";
import { fetchAll as fetchCctvPoints } from "../../services/api/cctvApi";
import { resolveCctvImagePath } from "../../utils/formatters";
import time from "../../utils/time";

export default {
  name: "RecentCctvCarousel",
  components: {
    Flickity
  },
  data() {
    return {
      items: [],
      flickityOptions: {
        initialIndex: 0,
        freeScroll: true,
        contain: true,
        prevNextButtons: false,
        pageDots: false
      }
    };
  },
  created() {
    this.loadRecentCctv();
  },
  methods: {
    loadRecentCctv() {
      fetchCctvPoints()
        .then((rows) => {
          this.items = rows.map((row) => ({
            id: row.id,
            name: row.name,
            imageUrl: resolveCctvImagePath(row.path_image),
            time: time(new Date(Date.parse(row.updated_at)))
          }));
        })
        .catch(() => {});
    }
  }
};
</script>

<style>
.carousel-cell {
  margin-top: 10px;
  width: 150px;
  height: 80px;
  overflow: hidden;
  margin-right: 10px;
  border-radius: 10px;
  position: relative;
  background-color: transparent;
  transition: all 0.15s ease;
}

.carousel-cell:before {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  height: 60%;
  width: 100%;
  z-index: 1;
  background: linear-gradient(180deg, rgba(13, 13, 13, 0) 0%, rgba(7, 7, 7, 1) 100%);
  mix-blend-mode: multiply;
  transition: all 0.5s ease;
}

.carousel-cell:hover {
  transform: translateY(2px);
  z-index: 1;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.carousel-cell:hover:before {
  height: 100%;
}

.carousel-cell:hover .contentRecent {
  margin-bottom: 0.2px;
  cursor: pointer;
}

.carousel-cell:hover .timeRecent {
  color: #32e18c;
  opacity: 1;
}

.imageRecent {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  -o-object-fit: cover;
  object-fit: cover;
  transition: all 0.5s ease;
}

.contentRecent {
  position: absolute;
  bottom: 0px;
  padding: 5px;
  z-index: 1;
  cursor: default;
  transition: 0.5s;
}

.nameRecent {
  color: white;
  font-size: var(--size-xs);
}

.timeRecent {
  color: white;
  opacity: 0.5;
  font-style: italic;
  font-size: var(--size-xs);
  transition: 0.5s;
}

.flickity-enabled {
  position: relative;
  display: flex;
  overflow: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.flickity-enabled::-webkit-scrollbar {
  width: 5px;
}

.flickity-enabled::-webkit-scrollbar-track {
  background: transparent;
}

.flickity-enabled::-webkit-scrollbar-thumb {
  background-color: rgba(var(--green-theme), 0.8);
  border-radius: 20px;
  border: none;
}
</style>
