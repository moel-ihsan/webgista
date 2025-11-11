<template>
  <div id="mapContainer" class="basemap">
    <!-- <nav id="layer-ctrl"></nav> -->
    <div
      id="zoomHome"
      @click="zoomHome"
      class="sidebar-toggle rounded-rect zoomHome"
    >
      <ion-icon name="home"></ion-icon>
    </div>
    <div id="panelLeft" class="sidebar-toggle rounded-rect left">
      <!-- <ion-icon name="search"></ion-icon> -->
      <el-popover
        placement="right"
        width="200"
        trigger="click"
        class="map-popover"
      >
        <p style="opacity: 0.5">Map Style</p>
        <el-radio-group v-model="style" id="mapStyle" class="radio-group-map">
          <el-radio
            @change.native="setMapStyle('streets-v11')"
            class="style-item"
            id="streets-v11"
            label="Street"
            >Street</el-radio
          >
          <el-radio
            @change.native="setMapStyle('light-v10')"
            class="style-item"
            id="light-v10"
            label="Light"
            >Light</el-radio
          >
          <el-radio
            @change.native="setMapStyle('dark-v10')"
            class="style-item"
            id="dark-v10"
            label="Dark"
            >Dark</el-radio
          >
          <el-radio
            @change.native="setMapStyle('outdoors-v11')"
            class="style-item"
            id="outdoors-v11"
            label="Outdoor"
            >Outdoor</el-radio
          >
        </el-radio-group>
        <p style="opacity: 0.5; margin-bottom: 10px">Layer</p>
        <el-checkbox-group v-model="checkList">
          <el-checkbox @change="greet(`${cities[1].id}`)" label="cctv"
            >CCTV</el-checkbox
          >
          <!-- layer cek -->
          <el-checkbox
            id="state-fills"
            @change="greet(`${cities[0].id}`)"
            label="adm"
            >Banda Aceh ADM</el-checkbox
          >
        </el-checkbox-group>
        <ion-icon slot="reference" name="layers"></ion-icon>
      </el-popover>
    </div>
    <div id="map">
      <div id="right" class="sidebar flex-center right collapsed">
        <div class="sidebar-content rounded-rect">
          <el-input placeholder="Please input" v-model="filterState"></el-input>
          <div class="search-card-item">
            <div v-for="item in getItems" :key="item">
              <div class="search-card">
                <div
                  class="search-info-card"
                  :id="item.id"
                  @click="flyin(`${item.id}`)"
                >
                  <div class="search-content">
                    <div class="name">{{ item.name }}</div>
                    <div class="coordinate">
                      {{ item.coordinate }}
                    </div>
                    <div class="address" v-if="item.address.length > 25">
                      {{ item.address.substr(0, 25) }} . . .
                    </div>
                    <div class="address" v-else>
                      {{ item.address }}
                    </div>
                    <el-button
                      class="detail"
                      :type="item.status === 'Regular' ? 'danger' : 'warning'"
                      round
                      >{{ item.status }}</el-button
                    >
                  </div>
                  <div class="search-icon">
                    <img class="search-img" :src="'/storage/' + item.source" />
                  </div>
                </div>
              </div>
            </div>
            <div v-if="getItems.length === 0">
              <div class="search-info-card no-data-match">No Data</div>
            </div>
          </div>
          <!-- </div> -->
          <div
            id="mapSeacrh"
            class="sidebar-toggle rounded-rect right"
            @click="toggleSidebar('right')"
          >
            <ion-icon name="close" v-if="rightCollapse == false"> </ion-icon>
            <ion-icon name="search" v-else></ion-icon>
          </div>
        </div>
      </div>
    </div>
    <div id="map-overlay" class="map-overlay"></div>
    <div id="state-legend" class="legend">
      <h4>Traffic Condition</h4>
      <div><span style="background-color: #ff0000"></span>Terrible</div>
      <div><span style="background-color: #ff5f00"></span>Bad</div>
      <div><span style="background-color: #d4a328"></span>Poor</div>
      <div><span style="background-color: #ffff00"></span>Average</div>
      <div><span style="background-color: #0b6623"></span>Good</div>
      <div><span style="background-color: #98fb98"></span>Great</div>
      <div><span style="background-color: #0000ff"></span>No Data</div>
    </div>
  </div>
</template>

<script>
import mapboxgl from "mapbox-gl";

export default {
  name: "BaseMap",

  data() {
    return {
      map: {},
      items: [],
      settingforms: [],
      filterState: "",
      style: "Street",
      checkList: ["cctv"],
      rightCollapse: null,
      accessToken:
        "pk.eyJ1IjoibW9lbC1paHNhbiIsImEiOiJjazljdmFhNzYwNnV2M21yM3IxaHgwamVnIn0.suuGn0UAUi-ud4rV2QCe4Q",
      mapSetStyle: "mapbox://styles/mapbox/streets-v11",
      cities: [
        {
          id: 1,
          name: "Banda Aceh ADM",
          lah: ["state-fills"],
          vis: "none",
        },
        {
          id: 2,
          name: "CCTV",
          lah: ["places", "cluster-count", "unclustered-point"],
          vis: "visible",
        },
      ],
    };
  },
  created() {
    this.fetchSetting();
    this.fetchCctv();
  },
  methods: {
    financial(x) {
      return Number.parseFloat(x).toFixed(6);
    },
    fetchSetting() {
      axios.get("/api/setting").then((res) => {
        res.data.forEach((settingRow, index) => {
          // console.log(res.data);
          this.settingforms.push({
            id: settingRow.id,
            center: [settingRow.longitude, settingRow.lattitude],
            zoom: settingRow.zoom,
          });
        });
      });
    },
    greet(layerID) {
      var layer = layerID - 1;
      var layernya = this.cities[layer].lah;
      // console.log(layernya);
      for (var i = 0; i < layernya.length; i++) {
        var visibility = this.map.getLayoutProperty(layernya[i], "visibility");
        // console.log(visibility);
        // // toggle layer visibility by changing the layout object's visibility property
        if (visibility === "visible") {
          this.map.setLayoutProperty(layernya[i], "visibility", "none");
          this.cities[layer].vis = "none";
          // link.classList.remove("is-checked");
        } else {
          // link.classList.add("is-checked");
          this.map.setLayoutProperty(layernya[i], "visibility", "visible");
          this.cities[layer].vis = "visible";
        }
        // console.log(visibility);
      }
    },
    setMapStyle(value) {
      this.map.setStyle("mapbox://styles/mapbox/" + value);
    },
    createPopUp(idx) {
      var index = this.items.findIndex((obj) => obj.id == idx);
      var popUpLanding = this.items[index].latLong;
      var nama = this.items[index].name;
      var category = this.items[index].status;
      var imageP = this.items[index].source;
      var imageSource = "/storage/" + imageP;
      var url = this.items[index].url;
      if (url == null) {
        var popsups = `<img id ='my-img' class="popup-img vidcctv" src='${imageSource}' />
            <br/>`;
      } else {
        var popsups = `<video id ='my-video' class="popup-img vidcctv" controls autoplay>
              <source src='${url}' type="video/mp4" />
            </video><br/>`;
      }

      // console.log(aha);
      var popUps = document.getElementsByClassName("mapboxgl-popup");
      if (popUps[0]) popUps[0].remove();
      var popup = new mapboxgl.Popup({ closeOnClick: true, offset: 10 })
        .setLngLat(popUpLanding)
        .setHTML(popsups)
        .addTo(this.map);
    },
    flyin(idx) {
      var items = this.items;
      var index = items.findIndex((obj) => obj.id == idx);
      var target = items[index].latLong;
      // var settingforms = this.settingforms[0];
      // console.log(settingforms.center);

      this.map.flyTo({
        center: target,
        zoom: 16,
        essential: true,
      });

      this.createPopUp(idx);
    },
    zoomHome() {
      axios.get("/api/setting").then((res) => {
        let settingMap = [];
        res.data.forEach((row, index) => {
          settingMap.push({
            pointID: `${row.id}`,
            coordinates: [row.longitude, row.lattitude],
            zoom: `${row.zoom}`,
          });
        });
        var center = settingMap[0].coordinates;
        var zoom = settingMap[0].zoom;
        this.map.flyTo({
          center: center,
          zoom: zoom,
          essential: true,
        });
      });

      var popUps = document.getElementsByClassName("mapboxgl-popup");
      if (popUps[0]) popUps[0].remove();
    },
    fetchCctv() {
      axios.get("/api/table").then((res) => {
        // this.total = res.data.length;
        res.data.forEach((row, index) => {
          this.items.push({
            id: row.id,
            name: row.name,
            address: row.address,
            coordinate: `${this.financial(row.longitude)} E ${this.financial(
              row.lattitude
            )} N`,
            latLong: [row.longitude, row.lattitude],
            status: row.category,
            source: row.path_image,
            url: row.url,
          });
        });
      });
    },

    handleCheckAllChange(val) {
      this.checkedCities.name = val ? cityOptions : [];
      this.isIndeterminate = false;
    },
    handleCheckedCitiesChange(value) {
      let checkedCount = value.length;
      this.checkAll = checkedCount === this.cities.length;
      this.isIndeterminate =
        checkedCount > 0 && checkedCount < this.cities.length;
    },

    toggleSidebar(id) {
      var elem = document.getElementById(id);
      var legend = document.getElementById("state-legend");
      var classes = elem.className.split(" ");
      var collapsed = classes.indexOf("collapsed") !== -1;

      var padding = {};

      if (collapsed) {
        legend.style.display = "none";
        // Remove the 'collapsed' class from the class list of the element, this sets it back to the expanded state.
        classes.splice(classes.indexOf("collapsed"), 1);

        padding[id] = 400; // In px, matches the width of the sidebars set in .sidebar CSS class
        this.map.easeTo({
          padding: padding,
          duration: 1000, // In ms, CSS transition duration property for the sidebar matches this value
        });
        this.rightCollapse = false;
      } else {
        legend.style.display = "block";
        padding[id] = 0;
        // Add the 'collapsed' class to the class list of the element
        classes.push("collapsed");
        this.rightCollapse = true;

        this.map.easeTo({
          padding: padding,
          duration: 1000,
        });
      }

      // Update the class list on the element
      elem.className = classes.join(" ");
    },
  },
  computed: {
    getItems() {
      var items = this.items.filter((item) => {
        return (
          item.name.toLowerCase().includes(this.filterState.toLowerCase()) ||
          item.address.toLowerCase().includes(this.filterState.toLowerCase()) ||
          item.status.toLowerCase().includes(this.filterState.toLowerCase())
        );
      });
      return items;
    },
  },
  mounted() {
    axios.get("/api/setting").then((res) => {
      let settingMap = [];
      // console.log(this.toggleableLayerIds[1].lah);

      res.data.forEach((row, index) => {
        settingMap.push({
          pointID: `${row.id}`,
          coordinates: [row.longitude, row.lattitude],
          zoom: `${row.zoom}`,
        });
      });
      // console.log();
      var center = settingMap[0].coordinates;
      var zoom = settingMap[0].zoom;

      mapboxgl.accessToken = this.accessToken;
      this.map = new mapboxgl.Map({
        container: "map",
        style: this.mapSetStyle,
        center: center,
        minZoom: 2,
        zoom: zoom,
      });
      var map = this.map;

      const nav = new mapboxgl.NavigationControl();
      this.map.addControl(nav, "top-left");

      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      });

      this.map.addControl(geolocate, "top-left");
      // var toggleLayer;
      // });

      var lay = this.cities;

      this.map.on("style.load", function () {
        var vis1 = lay[1].vis;
        map.loadImage(
          "https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png",
          // Add an image to use as a custom marker
          function (error, image) {
            if (error) throw error;
            map.addImage("custom-marker", image);

            // while (true) {
            // setTimeout(() => {
            axios.get("/api/table").then((res) => {
              let features = [];

              res.data.forEach((row, index) => {
                var videoPop = `<video id ='my-video' class="popup-img vidcctv" controls autoplay>
                  <source src='${row.url}' type="video/mp4" />
                  </video><br/>`;
                var imageP = `${row.path_image}`;
                var imageSource = "/storage/" + imageP;
                var popsups = `<img id ='my-img' class="popup-img vidcctv" src='${imageSource}' /><br/>`;
                features.push({
                  type: "Feature",
                  properties: {
                    pointID: `${row.id}`,
                    description: `${row.url}` == "null" ? popsups : videoPop,
                    traffic: `${row.category}`,
                    cond: `${row.keterangan}`,
                    // description: `<video class='popup-img' autoplay><source src='${row.url}' type='video/mp4'></video>`,
                  },
                  geometry: {
                    type: "Point",
                    coordinates: [row.longitude, row.lattitude],
                  },
                });
              });

              let geojson = {
                type: "FeatureCollection",
                features: features,
              };

              map.addSource("data", {
                type: "geojson",
                data: geojson,
                cluster: true,
                clusterMaxZoom: 14, // Max zoom to cluster points on
                clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
              });
              // return geojson;

              map.addLayer({
                id: "places",
                source: "data",
                type: "circle",
                filter: ["has", "point_count"],
                layout: {
                  visibility: vis1,
                },
                paint: {
                  // Use step expressions (https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
                  // with three steps to implement three types of circles:
                  //   * Blue, 20px circles when point count is less than 100
                  //   * Yellow, 30px circles when point count is between 100 and 750
                  //   * Pink, 40px circles when point count is greater than or equal to 750
                  "circle-color": [
                    "step",
                    ["get", "point_count"],
                    "#51bbd6",
                    100,
                    "#f1f075",
                    750,
                    "#f28cb1",
                  ],
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    20,
                    100,
                    30,
                    750,
                    40,
                  ],
                },
              });

              // map.setLayoutProperty(toggleLayer1, "visibility", "visible");

              map.addLayer({
                id: "cluster-count",
                type: "symbol",
                source: "data",
                filter: ["has", "point_count"],
                layout: {
                  "text-field": "{point_count_abbreviated}",
                  "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                  "text-size": 12,
                  visibility: vis1,
                },
              });
              map.addLayer({
                id: "unclustered-point",
                type: "circle",
                source: "data",
                filter: ["!", ["has", "point_count"]],
                layout: {
                  visibility: vis1,
                },
                paint: {
                  // "circle-color": color,
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
                    "#0000FF",
                  ],
                },
              });

              // FIXME: marking
              // realtime
              setInterval(() => {
                // data yang mau diubah
                console.log("masuk");
                axios.get("/api/table").then((newres) => {
                  newres.data.forEach((row, index) => {
                    // console.log(geojson);
                    // console.log(geojson.features[index].properties.cond);
                    geojson.features[
                      index
                    ].properties.cond = `${row.keterangan}`;
                  });
                  map.getSource("data").setData(geojson);
                });
                // geojson.features =
              }, 1000);
              // FIXME: ending marking

              // map.setLayoutProperty("unclustered-point", "visibility", "none");
            });
            // }, 5000);
            // }
          }
        );

        map.on("click", "places", function (e) {
          var features = map.queryRenderedFeatures(e.point, {
            layers: ["places"],
          });
          var clusterId = features[0].properties.cluster_id;
          map
            .getSource("data")
            .getClusterExpansionZoom(clusterId, function (err, zoom) {
              if (err) return;

              map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom,
              });
            });
        });

        // When a click event occurs on a feature in the places layer, open a popup at the
        // location of the feature, with description HTML from its properties.
        map.on("click", "unclustered-point", function (e) {
          var coordinates = e.features[0].geometry.coordinates.slice();
          var description = e.features[0].properties.description;

          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(description)
            .addTo(map);

          // this.$nextTick(this.flyin(id));
        });

        // Change the cursor to a pointer when the mouse is over the places layer.
        map.on("mouseenter", "places", function () {
          map.getCanvas().style.cursor = "pointer";
        });

        map.on("mouseenter", "unclustered-point", function () {
          map.getCanvas().style.cursor = "pointer";
        });

        // Change it back to a pointer when it leaves.
        map.on("mouseleave", "places", function () {
          map.getCanvas().style.cursor = "";
        });

        map.on("mouseleave", "unclustered-point", function () {
          map.getCanvas().style.cursor = "";
        });
      });

      var overlay = document.getElementById("map-overlay");
      var hoveredStateId = null;

      map.on("style.load", function () {
        var vis2 = lay[0].vis;

        map.addSource("bandaaceh", {
          type: "geojson",
          data: "geojson/bandaacehgeojson.geojson",
        });

        // The feature-state dependent fill-opacity expression will render the hover effect
        // when a feature's hover state is set to true.
        map.addLayer({
          id: "state-fills",
          type: "fill",
          source: "bandaaceh",
          // visibility: "none",
          layout: {
            visibility: vis2,
          },
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
              "#011f4b",
            ],
            "fill-outline-color": "white",

            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.8,
              0.5,
            ],
          },
        });

        // When the user moves their mouse over the state-fill layer, we'll update the
        // feature state for the feature under the mouse.
        map.on("mousemove", "state-fills", function (e) {
          if (e.features.length > 0) {
            if (hoveredStateId) {
              map.setFeatureState(
                { source: "bandaaceh", id: hoveredStateId },
                { hover: false }
              );
            }
            hoveredStateId = e.features[0].id;
            map.setFeatureState(
              { source: "bandaaceh", id: hoveredStateId },
              { hover: true }
            );
            overlay.innerHTML = "";
            var title = document.createElement("strong");
            title.textContent = e.features[0].properties.KECAMATAN;

            var large = document.createElement("div");
            large.textContent =
              "Total large: " + e.features[0].properties.Luas + " ha";

            overlay.appendChild(title);
            overlay.appendChild(large);
            overlay.style.display = "block";
          }
        });

        // When the mouse leaves the state-fill layer, update the feature state of the
        // previously hovered feature.
        map.on("mouseleave", "state-fills", function () {
          if (hoveredStateId) {
            map.setFeatureState(
              { source: "bandaaceh", id: hoveredStateId },
              { hover: false }
            );
            overlay.style.display = "none";
          }
          hoveredStateId = null;
        });
      });
    });
  },
};
</script>

<style>
.legend {
  background-color: var(--color-secondary);
  border-radius: 10px;
  bottom: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-size: var(--size-sm);
  padding: 10px;
  position: absolute;
  right: 10px;
  z-index: 1;
  color: var(--text-color);
}

.legend h4 {
  margin: 0 0 10px;
  font-size: var(--size-md);
}

.legend div span {
  border-radius: 10px;
  display: inline-block;
  height: 10px;
  margin-right: 5px;
  width: 10px;
}

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
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E");
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
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E");
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
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10.5 14l4-8 4 8h-8z'/%3E%3Cpath d='M10.5 16l4 8 4-8h-8z' fill='%23ccc'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 29 29' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10.5 14l4-8 4 8h-8z'/%3E%3Cpath d='M10.5 16l4 8 4-8h-8z' fill='%23ccc'/%3E%3C/svg%3E");
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
  background-image: none;
  -webkit-mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 005.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 009 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 003.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0011 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 110 7 3.5 3.5 0 110-7z'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3C/svg%3E");
  mask: url("data:image/svg+xml;charset=utf-8,%3Csvg width='29' height='29' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg' fill='%23333'%3E%3Cpath d='M10 4C9 4 9 5 9 5v.1A5 5 0 005.1 9H5s-1 0-1 1 1 1 1 1h.1A5 5 0 009 14.9v.1s0 1 1 1 1-1 1-1v-.1a5 5 0 003.9-3.9h.1s1 0 1-1-1-1-1-1h-.1A5 5 0 0011 5.1V5s0-1-1-1zm0 2.5a3.5 3.5 0 110 7 3.5 3.5 0 110-7z'/%3E%3Ccircle cx='10' cy='10' r='2'/%3E%3C/svg%3E");
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

/*
The sidebar styling has them "expanded" by default, we use CSS transforms to push them offscreen
The toggleSidebar() function removes this class from the element in order to expand it.
*/
.left.collapsed {
  transform: translateX(-295px);
}
.right.collapsed {
  transform: translateX(295px);
}
#mapSeacrh ion-icon {
  width: 20px;
}

#panelLeft ion-icon {
  width: 20px;
}

/* .input-here {
  z-index: 2;
} */
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
.mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
  border-top-color: var(--color-secondary);
}
.mapboxgl-popup-anchor-top .mapboxgl-popup-tip {
  border-bottom-color: var(--color-secondary);
}

.mapboxgl-popup-anchor-bottom-left .mapboxgl-popup-tip {
  border-top-color: var(--color-secondary);
}
.mapboxgl-popup-anchor-bottom-right .mapboxgl-popup-tip {
  border-top-color: var(--color-secondary);
}
.mapboxgl-popup-anchor-top-left .mapboxgl-popup-tip {
  border-bottom-color: var(--color-secondary);
}
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
.mapboxgl-ctrl-attrib-inner {
  display: none;
}

.mapboxgl-popup-close-button {
  display: none;
}

.radio-group-map {
  display: flex;
  flex-direction: column;
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

.radio-group-map {
  margin-top: 10px;
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