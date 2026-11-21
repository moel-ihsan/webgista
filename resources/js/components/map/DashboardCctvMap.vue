<template>
  <div>
    <el-card :body-style="{ padding: '0px' }" class="cardCCTV">
      <div id="map" ref="dashboardMap" />
      <MapLegend title="CCTV Category" :items="legendItems" />
    </el-card>
  </div>
</template>

<script>
import maplibregl from "maplibre-gl";
import MapLegend from "./MapLegend.vue";
import {
  CLUSTER_TEXT_FONT,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapStyle
} from "../../config/map";
import { fetchAll as fetchCctvPoints } from "../../services/api/cctvApi";
import { fetchAll as fetchMapSettings } from "../../services/api/mapSettingApi";
import { isDarkTheme, subscribeTheme } from "../../services/theme";
import { escapeHtml } from "../../utils/formatters";

export default {
  name: "DashboardCctvMap",
  components: {
    MapLegend
  },
  data() {
    return {
      map: null,
      flyTimers: [],
      resizeObserver: null,
      unsubscribeTheme: null,
      legendItems: [
        { label: "Analytic", color: "#facc15" },
        { label: "Regular", color: "#15803d" }
      ]
    };
  },
  mounted() {
    this.initDashboardMap();
    this.bindResizeObserver();
    this.unsubscribeTheme = subscribeTheme(({ isDark }) => {
      if (this.map && typeof this.map.setStyle === "function") {
        this.map.setStyle(getMapStyle(isDark ? "dark" : "streets"), { diff: false });
      }
    });
  },
  beforeDestroy() {
    this.flyTimers.forEach((timerId) => clearTimeout(timerId));
    this.flyTimers = [];
    if (this.resizeObserver && typeof this.resizeObserver.disconnect === "function") {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof this.unsubscribeTheme === "function") {
      this.unsubscribeTheme();
      this.unsubscribeTheme = null;
    }
    if (this.map && typeof this.map.remove === "function") {
      this.map.remove();
    }
  },
  methods: {
    bindResizeObserver() {
      if (typeof ResizeObserver === "undefined" || !this.$refs.dashboardMap) {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map && typeof this.map.resize === "function") {
          this.map.resize();
        }
      });
      this.resizeObserver.observe(this.$refs.dashboardMap);
    },
    initDashboardMap() {
      fetchMapSettings()
        .then((settings) => {
          const primary = settings && settings.length ? settings[0] : null;
          const center = primary
            ? [Number(primary.longitude), Number(primary.lattitude)]
            : DEFAULT_MAP_CENTER;
          const zoom = primary ? Number(primary.zoom) : DEFAULT_MAP_ZOOM;

          this.map = new maplibregl.Map({
            container: "map",
            style: getMapStyle(isDarkTheme() ? "dark" : "streets"),
            center,
            minZoom: 2,
            zoom,
            interactive: false,
            attributionControl: false
          });

          const map = this.map;
          map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
          map.on("style.load", () => {
            this.loadCctvPoints(map);
          });
          if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(() => {
              if (this.map && typeof this.map.resize === "function") {
                this.map.resize();
              }
            });
          }
        })
        .catch(() => {});
    },
    loadCctvPoints(map) {
      fetchCctvPoints()
        .then((rows) => {
          const features = rows.map((row) => {
            const safeName = escapeHtml(row.name);
            const safeCategory = escapeHtml(row.category);

            return {
              type: "Feature",
              properties: {
                pointID: String(row.id),
                traffic: `${row.category}`,
                flyLoc: `<div id="isi" class="dashboard-popup-title">${safeName}</div><div class="dashboard-popup-meta">Status: ${safeCategory}</div>`
              },
              geometry: {
                type: "Point",
                coordinates: [Number(row.longitude), Number(row.lattitude)]
              }
            };
          });

          const geojson = {
            type: "FeatureCollection",
            features
          };

          if (!map.getSource("data")) {
            map.addSource("data", {
              type: "geojson",
              data: geojson,
              cluster: true,
              clusterMaxZoom: 14,
              clusterRadius: 50
            });
          } else {
            map.getSource("data").setData(geojson);
          }

          if (!map.getLayer("places")) {
            map.addLayer({
              id: "places",
              source: "data",
              type: "circle",
              filter: ["has", "point_count"],
              layout: { visibility: "visible" },
              paint: {
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#51bbd6",
                  100,
                  "#f1f075",
                  750,
                  "#f28cb1"
                ],
                "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40]
              }
            });
          }

          if (!map.getLayer("cluster-count")) {
            map.addLayer({
              id: "cluster-count",
              type: "symbol",
              source: "data",
              filter: ["has", "point_count"],
              layout: {
                "text-field": "{point_count_abbreviated}",
                "text-font": CLUSTER_TEXT_FONT,
                "text-size": 12,
                visibility: "visible"
              }
            });
          }

          if (!map.getLayer("unclustered-point")) {
            map.addLayer({
              id: "unclustered-point",
              type: "circle",
              source: "data",
              filter: ["!", ["has", "point_count"]],
              layout: { visibility: "visible" },
              paint: {
                "circle-radius": 11,
                "circle-stroke-width": 2,
                "circle-stroke-color": isDarkTheme() ? "#1E1E2E" : "#FFFFFF",
                "circle-color": [
                  "match",
                  ["get", "traffic"],
                  "Regular",
                  "#15803d",
                  "Analytic",
                  "#facc15",
                  "#dc2626"
                ]
              }
            });
          }

          this.flyTimers.forEach((id) => clearTimeout(id));
          this.flyTimers = [];

          geojson.features.forEach((geo, index) => {
            const timerId = setTimeout(() => {
              map.flyTo({
                center: geo.geometry.coordinates,
                zoom: 16,
                essential: true
              });
              const popUps = document.getElementsByClassName("maplibregl-popup");
              if (popUps[0]) {
                popUps[0].remove();
              }
              new maplibregl.Popup({ closeOnClick: true, focusAfterOpen: false, offset: 12 })
                .setLngLat(geo.geometry.coordinates)
                .setHTML(geo.properties.flyLoc)
                .addTo(map);
            }, 5000 * index);
            this.flyTimers.push(timerId);
          });
        })
        .catch(() => {});
    }
  }
};
</script>

<style>
.cardCCTV {
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  height: 450px;
  overflow: hidden;
  position: relative;
  box-shadow: var(--shadow-card);
}

.cardCCTV #map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.dashboard-popup-title {
  font-size: var(--text-base);
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
  padding-right: 44px;
}

.dashboard-popup-meta {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

@media screen and (max-width: 767px) {
  .cardCCTV {
    height: 360px;
    margin-bottom: 0;
  }
}
</style>
