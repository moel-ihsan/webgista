<template>
  <div ref="pickerMap" class="coordinate-picker-root" />
</template>

<script>
import maplibregl from "maplibre-gl";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getMapStyle } from "../../config/map";
import { isDarkTheme, subscribeTheme } from "../../services/theme";
import { createPulsingDot } from "../../utils/pulsingDot";

export default {
  name: "CoordinatePickerMap",
  props: {
    longitude: {
      type: [Number, String],
      default: DEFAULT_MAP_CENTER[0]
    },
    latitude: {
      type: [Number, String],
      default: DEFAULT_MAP_CENTER[1]
    },
    zoom: {
      type: [Number, String],
      default: DEFAULT_MAP_ZOOM
    },
    interactive: {
      type: Boolean,
      default: true
    },
    selectable: {
      type: Boolean,
      default: false
    },
    popupHtml: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      map: null,
      popup: null,
      isLoaded: false,
      resizeObserver: null,
      unsubscribeTheme: null
    };
  },
  computed: {
    centerCoords() {
      const lng = Number(this.longitude);
      const lat = Number(this.latitude);
      return [
        Number.isFinite(lng) ? lng : DEFAULT_MAP_CENTER[0],
        Number.isFinite(lat) ? lat : DEFAULT_MAP_CENTER[1]
      ];
    },
    numericZoom() {
      const parsed = Number(this.zoom);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAP_ZOOM;
    }
  },
  watch: {
    centerCoords(nextCoords) {
      this.syncMarker(nextCoords, this.numericZoom);
    },
    numericZoom(nextZoom) {
      if (this.map) {
        this.map.setZoom(nextZoom);
      }
    },
    popupHtml(nextHtml) {
      if (this.popup && nextHtml) {
        this.popup.setHTML(nextHtml);
      }
    }
  },
  mounted() {
    const map = new maplibregl.Map({
      container: this.$el,
      style: getMapStyle(isDarkTheme() ? "dark" : "streets"),
      center: this.centerCoords,
      minZoom: 2,
      zoom: this.numericZoom,
      interactive: this.interactive,
      attributionControl: false
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    this.map = map;

    if (this.popupHtml) {
      this.popup = new maplibregl.Popup({ closeOnClick: false, offset: 15 })
        .setLngLat(this.centerCoords)
        .setHTML(this.popupHtml)
        .addTo(map);
    }

    map.on("style.load", () => {
      this.renderMarkerLayer(map);
    });

    if (this.selectable) {
      map.on("click", (e) => {
        this.$emit("select-coordinate", {
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
          zoom: map.getZoom()
        });
      });
    }

    this.bindResizeObserver();
    this.unsubscribeTheme = subscribeTheme(({ isDark }) => {
      this.isLoaded = false;
      if (this.map && typeof this.map.setStyle === "function") {
        this.map.setStyle(getMapStyle(isDark ? "dark" : "streets"), { diff: false });
      }
    });

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        if (this.map && typeof this.map.resize === "function") {
          this.map.resize();
        }
      });
    }
  },
  beforeDestroy() {
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
      if (typeof ResizeObserver === "undefined" || !this.$refs.pickerMap) {
        return;
      }
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map && typeof this.map.resize === "function") {
          this.map.resize();
        }
      });
      this.resizeObserver.observe(this.$refs.pickerMap);
    },
    renderMarkerLayer(map) {
      this.isLoaded = true;
      const pulsingDot = createPulsingDot(map);
      if (!map.hasImage("pulsing-dot")) {
        map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });
      }

      const geojson = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: this.centerCoords
            }
          }
        ]
      };

      if (!map.getSource("points")) {
        map.addSource("points", { type: "geojson", data: geojson });
      } else {
        map.getSource("points").setData(geojson);
      }

      if (!map.getLayer("points")) {
        map.addLayer({
          id: "points",
          type: "symbol",
          source: "points",
          layout: {
            "icon-image": "pulsing-dot"
          }
        });
      }
    },
    syncMarker(coords, zoomValue) {
      if (!this.map) {
        return;
      }

      this.map.setCenter(coords);
      if (Number.isFinite(zoomValue)) {
        this.map.setZoom(zoomValue);
      }
      if (this.popup) {
        this.popup.setLngLat(coords);
      }
      const source = this.isLoaded ? this.map.getSource("points") : null;
      if (source) {
        source.setData({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coords
              }
            }
          ]
        });
      }
    }
  }
};
</script>

<style>
.coordinate-picker-root {
  width: 100%;
  height: 100%;
  min-height: 200px;
}
</style>
