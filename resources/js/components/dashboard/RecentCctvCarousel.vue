<template>
  <div class="recent-carousel-wrap">
    <div v-if="items.length" class="recent-desktop-carousel">
      <flickity ref="flickity" :options="flickityOptions">
        <div v-for="item in items" :key="'desk-' + item.id" class="carousel-slide">
          <a :href="'/detail/' + item.id" class="carousel-cell-link">
            <div class="carousel-cell">
              <img :src="item.imageUrl" :alt="`Pratinjau ${item.name}`" class="imageRecent" />
              <div class="carousel-scrim" aria-hidden="true" />
              <div class="contentRecent">
                <div class="nameRecent">{{ item.name }}</div>
                <div class="timeRecent">{{ item.time }}</div>
              </div>
            </div>
          </a>
        </div>
      </flickity>
    </div>

    <div v-if="items.length" class="recent-mobile-grid">
      <a
        v-for="item in items"
        :key="'mob-' + item.id"
        :href="'/detail/' + item.id"
        class="carousel-cell-link"
      >
        <div class="carousel-cell carousel-cell--fluid">
          <img :src="item.imageUrl" :alt="`Pratinjau ${item.name}`" class="imageRecent" />
          <div class="carousel-scrim" aria-hidden="true" />
          <div class="contentRecent">
            <div class="nameRecent">{{ item.name }}</div>
            <div class="timeRecent">{{ item.time }}</div>
          </div>
        </div>
      </a>
    </div>
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
        cellAlign: "left",
        freeScroll: true,
        contain: true,
        prevNextButtons: false,
        pageDots: false,
        accessibility: false
      }
    };
  },
  created() {
    this.loadRecentCctv();
  },
  methods: {
    clearFlickityAriaHidden() {
      if (typeof this.$el === "undefined" || typeof this.$el.querySelectorAll !== "function") {
        return;
      }
      this.$el.querySelectorAll(".carousel-slide[aria-hidden]").forEach((el) => {
        el.removeAttribute("aria-hidden");
      });
    },
    loadRecentCctv() {
      fetchCctvPoints()
        .then((rows) => {
          this.items = rows.map((row) => ({
            id: row.id,
            name: row.name,
            imageUrl: resolveCctvImagePath(row.path_image),
            time: time(new Date(Date.parse(row.updated_at)))
          }));
          this.$nextTick(() => {
            this.clearFlickityAriaHidden();
            if (typeof setTimeout === "function") {
              setTimeout(() => this.clearFlickityAriaHidden(), 250);
            }
          });
        })
        .catch(() => {});
    }
  }
};
</script>

<style>
.recent-carousel-wrap {
  width: 100%;
  overflow: hidden;
}

.recent-desktop-carousel {
  display: block;
}

.recent-mobile-grid {
  display: none;
}

.carousel-slide {
  padding: 4px 10px 4px 0;
}

.carousel-cell-link {
  display: inline-block;
  border-radius: var(--radius-md);
}

.carousel-cell {
  width: 148px;
  height: 92px;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  position: relative;
  background-color: var(--bg-surface-subtle);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.carousel-cell--fluid {
  width: 100%;
}

.carousel-cell:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}

.imageRecent {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.45s ease;
}

.carousel-cell:hover .imageRecent {
  transform: scale(1.15);
}

.carousel-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.08) 15%, rgba(15, 23, 42, 0.88) 100%);
  pointer-events: none;
}

.contentRecent {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px;
  z-index: 1;
}

.nameRecent {
  color: #ffffff;
  font-size: var(--text-caption);
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.timeRecent {
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 500;
  margin-top: 2px;
}

@media screen and (max-width: 767px) {
  .recent-desktop-carousel {
    display: none;
  }

  .recent-mobile-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .carousel-cell-link {
    display: block;
    width: 100%;
  }
}
</style>
