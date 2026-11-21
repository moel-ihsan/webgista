<template>
  <div id="map" />
</template>

<script>
import mapboxgl from "mapbox-gl";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  getMapboxAccessToken,
  getMapboxStyleUrl
} from "../../config/mapbox";
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
      isLoaded: false
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
    mapboxgl.accessToken = getMapboxAccessToken();
    const map = new mapboxgl.Map({
      container: this.$el,
      style: getMapboxStyleUrl("streets-v11"),
      center: this.centerCoords,
      minZoom: 2,
      zoom: this.numericZoom,
      interactive: this.interactive
    });
    this.map = map;

    if (this.popupHtml) {
      this.popup = new mapboxgl.Popup({ closeOnClick: false, offset: 15 })
        .setLngLat(this.centerCoords)
        .setHTML(this.popupHtml)
        .addTo(map);
    }

    const pulsingDot = createPulsingDot(map);
    map.on("load", () => {
      this.isLoaded = true;
      map.addImage("pulsing-dot", pulsingDot, { pixelRatio: 2 });
      map.addSource("points", {
        type: "geojson",
        data: {
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
        }
      });
      map.addLayer({
        id: "points",
        type: "symbol",
        source: "points",
        layout: {
          "icon-image": "pulsing-dot"
        }
      });
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
  },
  beforeDestroy() {
    if (this.map && typeof this.map.remove === "function") {
      this.map.remove();
    }
  },
  methods: {
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
