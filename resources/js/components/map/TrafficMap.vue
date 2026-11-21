<template>
  <div id="mapContainer" ref="mapContainer" class="basemap">
    <div id="map">
      <MapSearchSidebar
        :items="filteredItems"
        :total-count="items.length"
        :filter-text.sync="filterState"
        :is-collapsed="rightCollapsed"
        @select="flyToCctv"
        @toggle="toggleSidebar"
      />
    </div>

    <button
      id="zoomHome"
      type="button"
      class="sidebar-toggle rounded-rect zoomHome"
      aria-label="Reset posisi peta ke Banda Aceh"
      title="Reset Zoom"
      @click="zoomHome"
    >
      <AppIcon name="home" :size="18" />
    </button>

    <MapLayerControl
      :selected-style="style"
      :checked-layers.sync="checkList"
      @change-style="handleStyleChange"
      @toggle-layer="toggleLayer"
    />

    <div id="map-overlay" class="map-overlay" />
    <MapLegend v-show="rightCollapsed" title="Traffic Condition" :items="legendItems" />
  </div>
</template>

<script>
import maplibregl from "maplibre-gl";
import MapLayerControl from "./MapLayerControl.vue";
import MapLegend from "./MapLegend.vue";
import MapSearchSidebar from "./MapSearchSidebar.vue";
import {
  CLUSTER_TEXT_FONT,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapStyle
} from "../../config/map";
import { fetchAll as fetchCctvPoints } from "../../services/api/cctvApi";
import { fetchAll as fetchMapSettings } from "../../services/api/mapSettingApi";
import { resolveCameraSimulation } from "../../config/simulation";
import { isDarkTheme, subscribeTheme } from "../../services/theme";
import {
  getGradeForCondition,
  NO_DATA_LEVEL,
  TRAFFIC_LEVELS
} from "../../services/traffic/ihcmClassifier";
import { escapeHtml, formatCoordinate, resolveCctvImagePath } from "../../utils/formatters";

export default {
  name: "TrafficMap",
  components: {
    MapLayerControl,
    MapLegend,
    MapSearchSidebar
  },
  data() {
    const darkActive = isDarkTheme();
    return {
      map: null,
      items: [],
      filterState: "",
      style: darkActive ? "Dark" : "Street",
      manualStyleOverride: false,
      checkList: ["cctv"],
      rightCollapsed: true,
      pollTimer: null,
      hoveredStateId: null,
      resizeObserver: null,
      unsubscribeTheme: null,
      cities: [
        {
          id: 1,
          name: "Banda Aceh ADM",
          layers: ["state-fills"],
          vis: "none"
        },
        {
          id: 2,
          name: "CCTV",
          layers: ["places", "cluster-count", "unclustered-point", "unclustered-point-grade"],
          vis: "visible"
        }
      ]
    };
  },
  computed: {
    legendItems() {
      return [...TRAFFIC_LEVELS].reverse().concat([NO_DATA_LEVEL]);
    },
    filteredItems() {
      const q = this.filterState.toLowerCase();
      return this.items.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(q) ||
          (item.address || "").toLowerCase().includes(q) ||
          (item.status || "").toLowerCase().includes(q) ||
          (item.cond || "").toLowerCase().includes(q) ||
          (item.grade || "").toLowerCase().includes(q)
      );
    }
  },
  created() {
    this.loadSidebarItems();
  },
  mounted() {
    this.initMap();
    this.bindResizeObserver();
    this.unsubscribeTheme = subscribeTheme(({ isDark }) => {
      if (this.manualStyleOverride) {
        return;
      }
      const nextStyleId = isDark ? "dark" : "streets";
      this.style = isDark ? "Dark" : "Street";
      if (this.map && typeof this.map.setStyle === "function") {
        this.map.setStyle(getMapStyle(nextStyleId), { diff: false });
      }
    });
  },
  beforeDestroy() {
    this.clearPolling();
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
      if (typeof ResizeObserver === "undefined" || !this.$refs.mapContainer) {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map && typeof this.map.resize === "function") {
          this.map.resize();
        }
      });
      this.resizeObserver.observe(this.$refs.mapContainer);
    },
    loadSidebarItems() {
      fetchCctvPoints()
        .then((rows) => {
          this.items = rows.map((row) => this.mapRowToSidebarItem(row));
        })
        .catch(() => {});
    },
    clearPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    mapRowToSidebarItem(row) {
      const condLabel = row.keterangan || NO_DATA_LEVEL.label;
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        coordinate: `${formatCoordinate(row.longitude)} E ${formatCoordinate(row.lattitude)} N`,
        latLong: [Number(row.longitude), Number(row.lattitude)],
        status: row.category,
        cond: condLabel,
        grade: getGradeForCondition(condLabel),
        source: row.path_image,
        imageUrl: resolveCctvImagePath(row.path_image),
        url: row.url
      };
    },
    buildPopupHtml(row) {
      const category = row.status || row.category;
      const condLabel = row.cond || row.keterangan || NO_DATA_LEVEL.label;
      const grade = getGradeForCondition(condLabel);
      const chipCode = grade === "?" ? "N" : grade;
      const safeName = escapeHtml(row.name || "CCTV");
      const safeCond = escapeHtml(condLabel);
      const safeDetailUrl = `/detail/${encodeURIComponent(String(row.id || ""))}`;
      const resolvedUrl =
        row.url || (category === "Analytic" ? resolveCameraSimulation(row).videoUrl : "");

      const mediaHtml = resolvedUrl
        ? `<video id="my-video" class="popup-img vidcctv" controls autoplay muted loop playsinline aria-label="Video CCTV ${safeName}"><source src="${escapeHtml(resolvedUrl)}" type="video/mp4" /></video>`
        : `<img id="my-img" class="popup-img vidcctv" src="${escapeHtml(resolveCctvImagePath(row.path_image))}" alt="Pratinjau CCTV ${safeName}" />`;

      return `<div class="map-popup-card">
        <div class="map-popup-header">
          <strong class="map-popup-name">${safeName}</strong>
          <span class="grade-chip grade-chip--sm grade-chip--${chipCode}" aria-label="Kondisi ${safeCond}">${escapeHtml(grade)}</span>
        </div>
        ${mediaHtml}
        <div class="map-popup-footer">
          <span class="map-popup-status">Status: ${safeCond}</span>
          <a href="${safeDetailUrl}" class="map-popup-link">Detail →</a>
        </div>
      </div>`;
    },
    toGeoJsonFeatures(rows) {
      return rows.map((row) => ({
        type: "Feature",
        properties: {
          pointID: String(row.id),
          description: this.buildPopupHtml(row),
          traffic: `${row.category}`,
          cond: `${row.keterangan}`,
          grade: getGradeForCondition(row.keterangan)
        },
        geometry: {
          type: "Point",
          coordinates: [Number(row.longitude), Number(row.lattitude)]
        }
      }));
    },
    initMap() {
      fetchMapSettings()
        .then((settings) => {
          const primary = settings && settings.length ? settings[0] : null;
          const center = primary
            ? [Number(primary.longitude), Number(primary.lattitude)]
            : DEFAULT_MAP_CENTER;
          const zoom = primary ? Number(primary.zoom) : DEFAULT_MAP_ZOOM;
          const initialStyle = isDarkTheme() ? "dark" : "streets";

          this.map = new maplibregl.Map({
            container: "map",
            style: getMapStyle(initialStyle),
            center,
            minZoom: 2,
            zoom,
            attributionControl: false
          });

          // Preserve exact vertical order on top-left:
          // (1) Navigation (+, -, Compass), (2) Geolocate (Find My Location), (3) Zoom Home, (4) Map Layer Control
          this.map.addControl(new maplibregl.NavigationControl(), "top-left");
          this.map.addControl(
            new maplibregl.GeolocateControl({
              positionOptions: { enableHighAccuracy: true },
              trackUserLocation: true
            }),
            "top-left"
          );
          this.map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

          this.registerMapEvents();
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
    registerMapEvents() {
      const map = this.map;
      if (!map) {
        return;
      }

      map.on("style.load", () => {
        this.loadCctvLayer(map);
        this.loadBoundaryLayer(map);
      });

      map.on("click", "places", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["places"] });
        if (!features.length) {
          return;
        }
        const clusterId = features[0].properties.cluster_id;
        map.getSource("data").getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) {
            return;
          }
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom
          });
        });
      });

      ["unclustered-point", "unclustered-point-grade"].forEach((layerId) => {
        map.on("click", layerId, (e) => {
          if (!e.features || !e.features.length) {
            return;
          }
          const coordinates = e.features[0].geometry.coordinates.slice();
          const description = e.features[0].properties.description;

          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          new maplibregl.Popup({ focusAfterOpen: false })
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);
        });
      });

      ["places", "unclustered-point", "unclustered-point-grade"].forEach((layerId) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      });

      const overlay = document.getElementById("map-overlay");

      map.on("mousemove", "state-fills", (e) => {
        if (!e.features || !e.features.length) {
          return;
        }
        if (this.hoveredStateId) {
          map.setFeatureState({ source: "bandaaceh", id: this.hoveredStateId }, { hover: false });
        }
        this.hoveredStateId = e.features[0].id;
        map.setFeatureState({ source: "bandaaceh", id: this.hoveredStateId }, { hover: true });
        if (overlay) {
          overlay.innerHTML = "";
          const title = document.createElement("strong");
          title.textContent = e.features[0].properties.KECAMATAN;
          const large = document.createElement("div");
          large.textContent = `Total large: ${e.features[0].properties.Luas} ha`;
          overlay.appendChild(title);
          overlay.appendChild(large);
          overlay.style.display = "block";
        }
      });

      map.on("mouseleave", "state-fills", () => {
        if (this.hoveredStateId) {
          map.setFeatureState({ source: "bandaaceh", id: this.hoveredStateId }, { hover: false });
          if (overlay) {
            overlay.style.display = "none";
          }
        }
        this.hoveredStateId = null;
      });
    },
    loadCctvLayer(map) {
      const cctvVisibility = this.cities[1].vis;

      fetchCctvPoints()
        .then((rows) => {
          this.items = rows.map((row) => this.mapRowToSidebarItem(row));
          let geojson = {
            type: "FeatureCollection",
            features: this.toGeoJsonFeatures(rows)
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
              layout: { visibility: cctvVisibility },
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
                visibility: cctvVisibility
              }
            });
          }

          if (!map.getLayer("unclustered-point")) {
            map.addLayer({
              id: "unclustered-point",
              type: "circle",
              source: "data",
              filter: ["!", ["has", "point_count"]],
              layout: { visibility: cctvVisibility },
              paint: {
                "circle-radius": 13,
                "circle-stroke-width": 2.5,
                "circle-stroke-color": isDarkTheme() ? "#1E1E2E" : "#FFFFFF",
                "circle-color": [
                  "match",
                  ["get", "cond"],
                  "Great",
                  "#98FB98",
                  "Good",
                  "#0B6623",
                  "Average",
                  "#FFFF00",
                  "Poor",
                  "#D4A328",
                  "Bad",
                  "#FF5F00",
                  "Terrible",
                  "#DC2626",
                  "#2563EB"
                ]
              }
            });
          }

          if (!map.getLayer("unclustered-point-grade")) {
            map.addLayer({
              id: "unclustered-point-grade",
              type: "symbol",
              source: "data",
              filter: ["!", ["has", "point_count"]],
              layout: {
                "text-field": ["get", "grade"],
                "text-font": CLUSTER_TEXT_FONT,
                "text-size": 12,
                "text-allow-overlap": true,
                visibility: cctvVisibility
              },
              paint: {
                "text-color": [
                  "match",
                  ["get", "cond"],
                  "Great",
                  "#0F2E1A",
                  "Good",
                  "#FFFFFF",
                  "Average",
                  "#241F00",
                  "Poor",
                  "#1F1500",
                  "Bad",
                  "#1F0B00",
                  "Terrible",
                  "#FFFFFF",
                  "#FFFFFF"
                ]
              }
            });
          }

          this.clearPolling();
          this.pollTimer = setInterval(() => {
            fetchCctvPoints()
              .then((latestRows) => {
                const source = map.getSource("data");
                if (!source) {
                  return;
                }
                const rowById = new Map(latestRows.map((row) => [String(row.id), row]));

                if (latestRows.length !== geojson.features.length) {
                  geojson = {
                    type: "FeatureCollection",
                    features: this.toGeoJsonFeatures(latestRows)
                  };
                  this.items = latestRows.map((row) => this.mapRowToSidebarItem(row));
                } else {
                  geojson.features.forEach((feature) => {
                    const matchedRow = rowById.get(feature.properties.pointID);
                    if (matchedRow) {
                      const nextCond = `${matchedRow.keterangan}`;
                      feature.properties.cond = nextCond;
                      feature.properties.grade = getGradeForCondition(nextCond);
                      feature.properties.description = this.buildPopupHtml(matchedRow);
                    }
                  });
                }

                source.setData(geojson);
              })
              .catch(() => {});
          }, 1000);
        })
        .catch(() => {});
    },
    loadBoundaryLayer(map) {
      const admVisibility = this.cities[0].vis;

      if (!map.getSource("bandaaceh")) {
        map.addSource("bandaaceh", {
          type: "geojson",
          data: "/geojson/bandaacehgeojson.geojson"
        });
      }

      if (!map.getLayer("state-fills")) {
        map.addLayer({
          id: "state-fills",
          type: "fill",
          source: "bandaaceh",
          layout: { visibility: admVisibility },
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["get", "Luas"],
              0,
              "#b3cde0",
              400,
              "#6497b1",
              800,
              "#005b96",
              1000,
              "#03396c",
              10000,
              "#011f4b"
            ],
            "fill-outline-color": "white",
            "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.8, 0.5]
          }
        });
      }
    },
    handleStyleChange(styleItem) {
      this.style = styleItem.label;
      this.manualStyleOverride = styleItem.id === "light" || styleItem.id === "outdoor";
      if (this.map) {
        this.map.setStyle(getMapStyle(styleItem.id), { diff: false });
      }
    },
    toggleLayer(layerId) {
      const layer = this.cities[layerId - 1];
      if (!layer || !this.map) {
        return;
      }

      layer.layers.forEach((layerName) => {
        if (!this.map.getLayer(layerName)) {
          return;
        }
        const visibility = this.map.getLayoutProperty(layerName, "visibility");
        const nextVis = visibility === "visible" ? "none" : "visible";
        this.map.setLayoutProperty(layerName, "visibility", nextVis);
        layer.vis = nextVis;
      });
    },
    flyToCctv(cctvId) {
      const targetItem = this.items.find((obj) => obj.id === cctvId);
      if (!targetItem || !this.map) {
        return;
      }

      this.map.flyTo({
        center: targetItem.latLong,
        zoom: 16,
        essential: true
      });

      const popUps = document.getElementsByClassName("maplibregl-popup");
      if (popUps[0]) {
        popUps[0].remove();
      }

      new maplibregl.Popup({ closeOnClick: true, focusAfterOpen: false, offset: 14 })
        .setLngLat(targetItem.latLong)
        .setHTML(
          this.buildPopupHtml({
            id: targetItem.id,
            name: targetItem.name,
            status: targetItem.status,
            cond: targetItem.cond,
            url: targetItem.url,
            path_image: targetItem.source
          })
        )
        .addTo(this.map);
    },
    zoomHome() {
      fetchMapSettings()
        .then((settings) => {
          const primary = settings && settings.length ? settings[0] : null;
          const center = primary
            ? [Number(primary.longitude), Number(primary.lattitude)]
            : DEFAULT_MAP_CENTER;
          const zoom = primary ? Number(primary.zoom) : DEFAULT_MAP_ZOOM;
          if (this.map) {
            this.map.flyTo({ center, zoom, essential: true });
          }
        })
        .catch(() => {});

      const popUps = document.getElementsByClassName("maplibregl-popup");
      if (popUps[0]) {
        popUps[0].remove();
      }
    },
    toggleSidebar() {
      const nextCollapsed = !this.rightCollapsed;
      this.rightCollapsed = nextCollapsed;

      if (this.map) {
        const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
        this.map.easeTo({
          padding: { right: nextCollapsed || isMobile ? 0 : 400 },
          duration: 1000
        });
      }
    }
  }
};
</script>

<style>
.vidcctv {
  display: block;
}

.basemap {
  position: relative;
  width: 100%;
  height: clamp(500px, calc(100vh - 170px), 760px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

#map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.rounded-rect {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-float);
}

.sidebar {
  position: absolute;
  top: 64px;
  right: 12px;
  max-height: calc(100% - 76px);
  transition: transform 0.3s ease, opacity 0.25s ease, visibility 0.3s ease;
  z-index: 15;
  width: min(320px, calc(100% - 24px));
  display: flex;
  flex-direction: column;
}

.sidebar-content {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 8px 8px;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-surface);
}

.right.collapsed {
  transform: translateX(calc(100% + 24px));
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}

.sidebar-toggle {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* Aligned cleanly right below Navigation (3x44+2=134) + Geolocate (44+2=46) with 12px edge & 10px gaps */
.sidebar-toggle.zoomHome {
  left: 12px;
  top: 212px;
  z-index: 10;
}

.sidebar-toggle.left {
  left: 12px;
  top: 266px;
  z-index: 10;
}

.sidebar-toggle:hover {
  background-color: var(--bg-surface-subtle);
  color: var(--accent-primary);
}

.map-overlay {
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  line-height: 1.45;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-float);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  position: absolute;
  max-width: 260px;
  bottom: 48px;
  left: 12px;
  padding: 10px 12px;
  z-index: 9;
  display: none;
}

.map-popup-card {
  width: min(260px, 70vw);
  font-family: var(--font-sans);
}

.map-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-right: 36px;
  margin-bottom: 8px;
}

.map-popup-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.popup-img {
  border-radius: var(--radius-sm);
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background-color: #0f172a;
  margin: 0 0 8px;
}

.map-popup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.map-popup-status {
  font-size: var(--text-caption);
  font-weight: 600;
  color: var(--text-secondary);
}

.map-popup-link {
  font-size: var(--text-caption);
  font-weight: 700;
  color: var(--accent-primary);
  text-decoration: underline;
  min-height: 28px;
  display: inline-flex;
  align-items: center;
}

.radio-group-map,
.checkbox-group-map {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.style-item,
.layer-item {
  margin-left: 0 !important;
  margin-right: 0 !important;
  min-height: 28px;
  display: flex;
  align-items: center;
}

@media screen and (max-width: 767px) {
  .basemap {
    height: clamp(500px, 72vh, 620px);
  }
}
</style>
