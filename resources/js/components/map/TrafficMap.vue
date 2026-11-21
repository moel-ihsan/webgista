<template>
  <div id="mapContainer" class="basemap">
    <div id="zoomHome" class="sidebar-toggle rounded-rect zoomHome" @click="zoomHome">
      <ion-icon name="home" />
    </div>
    <MapLayerControl
      :selected-style="style"
      :checked-layers.sync="checkList"
      @change-style="handleStyleChange"
      @toggle-layer="toggleLayer"
    />
    <div id="map">
      <MapSearchSidebar
        :items="filteredItems"
        :filter-text.sync="filterState"
        :is-collapsed="rightCollapsed"
        @select="flyToCctv"
        @toggle="toggleSidebar"
      />
    </div>
    <div id="map-overlay" class="map-overlay" />
    <MapLegend v-show="rightCollapsed" title="Traffic Condition" :items="legendItems" />
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl";
import MapLayerControl from "./MapLayerControl.vue";
import MapLegend from "./MapLegend.vue";
import MapSearchSidebar from "./MapSearchSidebar.vue";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapboxAccessToken,
  getMapboxStyleUrl
} from "../../config/mapbox";
import { fetchAll as fetchCctvPoints } from "../../services/api/cctvApi";
import { fetchAll as fetchMapSettings } from "../../services/api/mapSettingApi";
import { NO_DATA_LEVEL, TRAFFIC_LEVELS } from "../../services/traffic/ihcmClassifier";
import { escapeHtml, formatCoordinate, resolveCctvImagePath } from "../../utils/formatters";

export default {
  name: "TrafficMap",
  components: {
    MapLayerControl,
    MapLegend,
    MapSearchSidebar
  },
  data() {
    return {
      map: null,
      items: [],
      filterState: "",
      style: "Street",
      checkList: ["cctv"],
      rightCollapsed: true,
      pollTimer: null,
      hoveredStateId: null,
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
          layers: ["places", "cluster-count", "unclustered-point"],
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
          item.name.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q) ||
          item.status.toLowerCase().includes(q)
      );
    }
  },
  mounted() {
    this.initMap();
  },
  beforeDestroy() {
    this.clearPolling();
    if (this.map && typeof this.map.remove === "function") {
      this.map.remove();
    }
  },
  methods: {
    clearPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    mapRowToSidebarItem(row) {
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        coordinate: `${formatCoordinate(row.longitude)} E ${formatCoordinate(row.lattitude)} N`,
        latLong: [Number(row.longitude), Number(row.lattitude)],
        status: row.category,
        source: row.path_image,
        imageUrl: resolveCctvImagePath(row.path_image),
        url: row.url
      };
    },
    buildPopupHtml(row) {
      if (row.url) {
        const safeUrl = escapeHtml(row.url);
        return `<video id="my-video" class="popup-img vidcctv" controls autoplay><source src="${safeUrl}" type="video/mp4" /></video><br/>`;
      }
      const imageSource = escapeHtml(resolveCctvImagePath(row.path_image));
      return `<img id="my-img" class="popup-img vidcctv" src="${imageSource}" /><br/>`;
    },
    toGeoJsonFeatures(rows) {
      return rows.map((row) => ({
        type: "Feature",
        properties: {
          pointID: String(row.id),
          description: this.buildPopupHtml(row),
          traffic: `${row.category}`,
          cond: `${row.keterangan}`
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

          mapboxgl.accessToken = getMapboxAccessToken();
          this.map = new mapboxgl.Map({
            container: "map",
            style: getMapboxStyleUrl("streets-v11"),
            center,
            minZoom: 2,
            zoom
          });

          this.map.addControl(new mapboxgl.NavigationControl(), "top-left");
          this.map.addControl(
            new mapboxgl.GeolocateControl({
              positionOptions: { enableHighAccuracy: true },
              trackUserLocation: true
            }),
            "top-left"
          );

          this.registerMapEvents();
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

      map.on("click", "unclustered-point", (e) => {
        if (!e.features || !e.features.length) {
          return;
        }
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;

        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new mapboxgl.Popup().setLngLat(coordinates).setHTML(description).addTo(map);
      });

      ["places", "unclustered-point"].forEach((layerId) => {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
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
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
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
                "circle-radius": 10,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#fff",
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
                  "#FF0000",
                  "#0000FF"
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
                const conditionById = new Map(
                  latestRows.map((row) => [String(row.id), `${row.keterangan}`])
                );

                if (latestRows.length !== geojson.features.length) {
                  geojson = {
                    type: "FeatureCollection",
                    features: this.toGeoJsonFeatures(latestRows)
                  };
                  this.items = latestRows.map((row) => this.mapRowToSidebarItem(row));
                } else {
                  geojson.features.forEach((feature) => {
                    const nextCond = conditionById.get(feature.properties.pointID);
                    if (nextCond !== undefined) {
                      feature.properties.cond = nextCond;
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
      const overlay = document.getElementById("map-overlay");

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
    handleStyleChange(styleItem) {
      this.style = styleItem.label;
      if (this.map) {
        this.map.setStyle(getMapboxStyleUrl(styleItem.id));
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

      const popUps = document.getElementsByClassName("mapboxgl-popup");
      if (popUps[0]) {
        popUps[0].remove();
      }

      new mapboxgl.Popup({ closeOnClick: true, offset: 10 })
        .setLngLat(targetItem.latLong)
        .setHTML(this.buildPopupHtml({ url: targetItem.url, path_image: targetItem.source }))
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

      const popUps = document.getElementsByClassName("mapboxgl-popup");
      if (popUps[0]) {
        popUps[0].remove();
      }
    },
    toggleSidebar() {
      const nextCollapsed = !this.rightCollapsed;
      this.rightCollapsed = nextCollapsed;

      if (this.map) {
        this.map.easeTo({
          padding: { right: nextCollapsed ? 0 : 400 },
          duration: 1000
        });
      }
    }
  }
};
</script>

<style>
.vidcctv {
  display: inline-block;
}

.basemap {
  position: relative;
  width: 100%;
  height: 550px;
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

#map {
  position: absolute;
  top: 0;
  border-radius: 10px;
  bottom: 0;
  width: 100%;
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon {
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E");
  background-color: var(--text-color);
  transition: 0.5s;
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-in .mapboxgl-ctrl-icon:hover {
  background-color: var(--green-hover);
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon {
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E");
  background-color: var(--text-color);
  transition: 0.5s;
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-out .mapboxgl-ctrl-icon:hover {
  background-color: var(--green-hover);
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-compass .mapboxgl-ctrl-icon {
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10.5 14l4-8 4 8h-8z'/%3E%3Cpath d='M10.5 16l4 8 4-8h-8z' fill='%23ccc'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10.5 14l4-8 4 8h-8z'/%3E%3Cpath d='M10.5 16l4 8 4-8h-8z' fill='%23ccc'/%3E%3C/svg%3E");
  background-color: var(--text-color);
  transition: 0.5s;
}

.mapboxgl-ctrl button.mapboxgl-ctrl-zoom-compass .mapboxgl-ctrl-icon:hover {
  background-color: var(--green-hover);
}

.mapboxgl-ctrl button.mapboxgl-ctrl-geolocate .mapboxgl-ctrl-icon {
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 005.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 009 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 003.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0011 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 110 7 3.5 3.5 0 110-7z'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 005.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 009 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 003.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0011 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 110 7 3.5 3.5 0 110-7z'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3C/svg%3E");
  background-color: var(--text-color);
  transition: 0.5s;
}

.mapboxgl-ctrl button.mapboxgl-ctrl-geolocate .mapboxgl-ctrl-icon:hover {
  background-color: var(--green-hover);
}

.mapboxgl-ctrl button:not(:disabled):hover,
.mapboxgl-ctrl button:not(:disabled):focus {
  border-radius: 10px;
  background-color: var(--color-primary);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}

.mapboxgl-ctrl button:not(:disabled) {
  border-radius: 10px;
  transition: all 0.15s ease;
}

.mapboxgl-ctrl button:not(:disabled):active {
  border-radius: 10px;
  transform: translateY(1px) !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}

.mapboxgl-ctrl button {
  background-color: var(--color-secondary);
  border-color: var(--color-primary);
  border-radius: 10px;
}

.mapboxgl-ctrl-group button + button {
  border-top: none;
}

.mapboxgl-ctrl-group {
  border-radius: 10px;
}

.mapboxgl-ctrl-group:not(:empty) {
  box-shadow: 2px 2px 6px rgba(29, 29, 29, 0.2);
  background-color: var(--color-secondary);
}

.rounded-rect {
  background: var(--color-secondary);
  border-radius: 10px;
  box-shadow: 2px 2px 6px rgba(29, 29, 29, 0.2);
}

.flex-center {
  position: absolute;
  display: flex;
  justify-content: center;
  align-items: center;
}

.flex-center.right {
  top: 0px;
  right: 0px;
}

.sidebar-content {
  position: absolute;
  width: 95%;
  height: 95%;
  font-family: "montserrat";
  margin: 10px;
  background-color: transparent;
  box-shadow: none;
}

.sidebar-toggle {
  position: absolute;
  width: 29px;
  height: 29px;
  border-radius: 10px;
  top: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.15s ease;
}

.sidebar-toggle.right {
  left: -3.5em;
}

.sidebar-toggle.left {
  left: 10px;
  top: 190px;
  z-index: 2;
}

.sidebar-toggle.zoomHome {
  left: 10px;
  top: 150px;
  z-index: 2;
}

.sidebar-toggle.left ion-icon,
.sidebar-toggle.zoomHome ion-icon {
  display: flex;
  justify-content: center;
  align-items: center;
}

.sidebar-toggle.zoomHome ion-icon {
  font-size: 18px;
}

.sidebar-toggle:hover,
.sidebar-toggle:focus {
  cursor: pointer;
  color: var(--green-hover);
  background-color: var(--color-primary);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}

.sidebar-toggle:active {
  cursor: pointer;
  color: var(--green-hover);
  transform: translateY(1px) !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}

.sidebar {
  transition: transform 0.5s;
  z-index: 1;
  width: 300px;
  height: 100%;
}

.left.collapsed {
  transform: translateX(-295px);
}

.right.collapsed {
  transform: translateX(295px);
}

#mapSeacrh ion-icon,
#panelLeft ion-icon {
  width: 20px;
}

.mapboxgl-popup {
  max-width: 400px;
  border-radius: 10px;
  font-size: var(--size-md);
  color: var(--text-color);
}

.mapboxgl-popup-content {
  position: relative;
  background: var(--color-secondary);
  border-radius: 10px;
  padding: 10px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.1);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.1);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.1);
}

.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip,
.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip,
.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
  border-top-color: var(--color-secondary);
}

.mapboxgl-popup-anchor-top .mapboxgl-popup-tip,
.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip,
.mapboxgl-popup-anchor-top-right .mapboxgl-popup-tip {
  border-bottom-color: var(--color-secondary);
}

.mapboxgl-popup-anchor-right .mapboxgl-popup-tip {
  border-left-color: var(--color-secondary);
}

.mapboxgl-popup-anchor-left .mapboxgl-popup-tip {
  border-right-color: var(--color-secondary);
}

.popup-img {
  border-radius: 10px;
  top: 0;
  left: 0;
  width: 200px;
  height: 100px;
  -o-object-fit: cover;
  object-fit: cover;
  margin: 0;
  box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
  -webkit-box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
  -moz-box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
}

.map-overlay {
  font: 12px/20px "Montserat";
  background-color: var(--color-secondary);
  box-shadow: 2px 2px 6px rgba(29, 29, 29, 0.2);
  color: var(--text-color);
  border-radius: 10px;
  position: absolute;
  width: 25%;
  bottom: 10px;
  left: 10px;
  padding: 10px;
  display: none;
}

a.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-attrib-inner,
.mapboxgl-popup-close-button {
  display: none;
}

.radio-group-map {
  display: flex;
  flex-direction: column;
  margin-top: 10px;
}

.el-popover {
  background: var(--color-secondary);
  border: none;
  padding: 20px;
  border-radius: 10px;
  color: var(--text-color);
  line-height: 1.4;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.el-popper[x-placement^="right"] .popper__arrow::after {
  bottom: -6px;
  left: 1px;
  border-right-color: var(--color-secondary);
  border-left-width: 0;
}

.el-popper[x-placement^="top"] .popper__arrow::after {
  bottom: 1px;
  margin-left: -6px;
  border-top-color: var(--color-secondary);
  border-bottom-width: 0;
}

.el-radio {
  color: var(--text-color);
}

.el-radio__label {
  font-size: var(--size-md);
  font-weight: 400;
}

.el-radio__input.is-checked + .el-radio__label {
  color: var(--green-theme);
  font-size: var(--size-md);
  font-weight: 500;
}

.el-radio__input.is-checked .el-radio__inner {
  border-color: var(--green-theme);
  background: var(--green-theme);
}

.el-radio__inner::after {
  background-color: var(--green-theme);
}

.el-radio__inner:hover {
  border-color: var(--green-theme);
}

.el-radio__inner {
  border: none;
  background-color: var(--text-color);
}

.el-popper[x-placement^="right"] .popper__arrow {
  border-right-color: var(--color-secondary);
}

.el-checkbox__label {
  color: var(--text-color);
  font-weight: 400;
}

.el-checkbox__input.is-checked + .el-checkbox__label {
  color: var(--green-theme);
  font-size: var(--size-md);
  font-weight: 500;
}

.el-checkbox__input.is-checked .el-checkbox__inner,
.el-checkbox__input.is-indeterminate .el-checkbox__inner {
  background-color: var(--green-theme);
  border-color: var(--green-theme);
}

.el-checkbox__input.is-focus .el-checkbox__inner {
  border: 1px solid var(--green-theme);
}

.el-checkbox__inner:hover,
.el-checkbox__inner:active {
  border-color: var(--green-theme);
}

.el-checkbox__inner {
  border: 1px solid var(--text-color);
  border-radius: 4px;
  width: 14px;
  height: 14px;
  background-color: var(--text-color);
}
</style>
