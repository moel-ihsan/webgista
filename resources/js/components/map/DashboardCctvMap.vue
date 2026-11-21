<template>
  <div>
    <el-card :body-style="{ padding: '0px' }" class="cardCCTV">
      <div id="map" />
      <MapLegend title="CCTV Category" :items="legendItems" />
    </el-card>
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl";
import MapLegend from "./MapLegend.vue";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapboxAccessToken,
  getMapboxStyleUrl
} from "../../config/mapbox";
import { fetchAll as fetchCctvPoints } from "../../services/api/cctvApi";
import { fetchAll as fetchMapSettings } from "../../services/api/mapSettingApi";
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
      legendItems: [
        { label: "Analytic", color: "yellow" },
        { label: "Regular", color: "green" }
      ]
    };
  },
  mounted() {
    this.initDashboardMap();
  },
  beforeDestroy() {
    this.flyTimers.forEach((timerId) => clearTimeout(timerId));
    this.flyTimers = [];
    if (this.map && typeof this.map.remove === "function") {
      this.map.remove();
    }
  },
  methods: {
    initDashboardMap() {
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
            zoom,
            interactive: false
          });

          const map = this.map;
          map.on("style.load", () => {
            this.loadCctvPoints(map);
          });
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
                flyLoc: `<h1 id="isi" style="font-weight:600">${safeName}</h1><br/>Status : ${safeCategory}`
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
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
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
                "circle-radius": 10,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#fff",
                "circle-color": [
                  "match",
                  ["get", "traffic"],
                  "Regular",
                  "green",
                  "Analytic",
                  "yellow",
                  "red"
                ]
              }
            });
          }

          geojson.features.forEach((geo, index) => {
            const timerId = setTimeout(() => {
              map.flyTo({
                center: geo.geometry.coordinates,
                zoom: 16,
                essential: true
              });
              const popUps = document.getElementsByClassName("mapboxgl-popup");
              if (popUps[0]) {
                popUps[0].remove();
              }
              new mapboxgl.Popup({ closeOnClick: true, offset: 10 })
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
  border-radius: 10px;
  margin-bottom: 50px;
  border: none;
  height: 450px;
  overflow: hidden;
  position: relative;
  transition: all 0.5s ease;
}

.is-always-shadow {
  border: none;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
}

.image {
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  transition: all 0.5s ease;
}

.content {
  position: absolute;
  bottom: 0px;
  padding: 30px;
  z-index: 1;
  transition: 0.5s;
}

.nameCCTV {
  color: white;
  font-size: var(--size-lg);
  font-weight: 500;
}

.addressCCTV {
  color: #32e18c;
  font-size: var(--size-sm);
}
</style>
