<template>
    <div>
        <el-card :body-style="{ padding: '0px' }" class="cardCCTV">
            <div id="map"></div>
            <div id="state-legend" class="legend">
                <h4>CCTV Category</h4>
                <div>
                    <span style="background-color: yellow"></span>Analytic
                </div>
                <div><span style="background-color: green"></span>Regular</div>
            </div>
        </el-card>
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
            start: [95.327800887501041, 5.5628745289364],
            mapSetStyle: "mapbox://styles/mapbox/streets-v11",
            cities: [
                {
                    id: 1,
                    name: "Banda Aceh ADM",
                    lah: ["state-fills"],
                    vis: "none"
                },
                {
                    id: 2,
                    name: "CCTV",
                    lah: ["places", "cluster-count", "unclustered-point"],
                    vis: "visible"
                }
            ]
        };
    },
    created() {},
    methods: {
        createPopUp(idx) {
            var index = this.items.findIndex(obj => obj.id == idx);
            var popUpLanding = this.items[index].latLong;
            var nama = this.items[index].name;
            var url = this.items[index].url;
            var popsups = `<video id ='my-video' class='video-js vjs-default-skin vjs-big-play-centered popup-img vidcctv' preload='auto' autoplay controls data-setup='{}'>
									<source type='application/x-mpegURL' src='${url}'>
                </video><br/>`;
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
            var index = items.findIndex(obj => obj.id == idx);
            var target = items[index].latLong;
            // var settingforms = this.settingforms[0];
            // console.log(settingforms.center);

            this.map.flyTo({
                center: target,
                zoom: 16,
                essential: true
            });

            this.createPopUp(idx);
        }
    },
    mounted() {
        axios.get("/api/setting").then(res => {
            let settingMap = [];
            // console.log(this.toggleableLayerIds[1].lah);

            res.data.forEach((row, index) => {
                settingMap.push({
                    pointID: `${row.id}`,
                    coordinates: [row.longitude, row.lattitude],
                    zoom: `${row.zoom}`
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
                interactive: false
            });
            var map = this.map;

            var lay = this.cities;

            this.map.on("style.load", function() {
                var vis1 = lay[1].vis;
                map.loadImage(
                    "https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png",
                    // Add an image to use as a custom marker
                    function(error, image) {
                        if (error) throw error;
                        map.addImage("custom-marker", image);

                        axios.get("/api/table").then(res => {
                            let features = [];
                            // let traffic = [];
                            // console.log(this.toggleableLayerIds[1].lah);

                            res.data.forEach((row, index) => {
                                features.push({
                                    type: "Feature",
                                    properties: {
                                        pointID: `${row.id}`,
                                        description: `<video id ='my-video' class='video-js vjs-default-skin vjs-big-play-centered popup-img vidcctv' preload='auto' autoplay controls data-setup='{}'>
									<source type='application/x-mpegURL' src='${row.url}'>
                </video><br/>`,
                                        traffic: `${row.category}`,
                                        flyLoc: `<h1 id="isi" style="font-weight:600">${row.name}</h1><br/>Status : ${row.category}`
                                        // description: `<video class='popup-img' autoplay><source src='${row.url}' type='video/mp4'></video>`,
                                    },
                                    geometry: {
                                        type: "Point",
                                        coordinates: [
                                            row.longitude,
                                            row.lattitude
                                        ]
                                    }
                                });
                            });

                            let geojson = {
                                type: "FeatureCollection",
                                features: features
                            };

                            map.addSource("data", {
                                type: "geojson",
                                data: geojson,
                                cluster: true,
                                clusterMaxZoom: 14, // Max zoom to cluster points on
                                clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
                            });
                            // return geojson;

                            map.addLayer({
                                id: "places",
                                source: "data",
                                type: "circle",
                                filter: ["has", "point_count"],
                                layout: {
                                    visibility: vis1
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
                                        "#f28cb1"
                                    ],
                                    "circle-radius": [
                                        "step",
                                        ["get", "point_count"],
                                        20,
                                        100,
                                        30,
                                        750,
                                        40
                                    ]
                                }
                            });

                            // map.setLayoutProperty(toggleLayer1, "visibility", "visible");

                            map.addLayer({
                                id: "cluster-count",
                                type: "symbol",
                                source: "data",
                                filter: ["has", "point_count"],
                                layout: {
                                    "text-field": "{point_count_abbreviated}",
                                    "text-font": [
                                        "DIN Offc Pro Medium",
                                        "Arial Unicode MS Bold"
                                    ],
                                    "text-size": 12,
                                    visibility: vis1
                                }
                            });
                            map.addLayer({
                                id: "unclustered-point",
                                type: "circle",
                                source: "data",
                                filter: ["!", ["has", "point_count"]],
                                layout: {
                                    visibility: vis1
                                },
                                paint: {
                                    // "circle-color": color,
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

                            // map.setLayoutProperty("unclustered-point", "visibility", "none");

                            geojson.features.forEach(function(geo, index) {
                                setTimeout(function() {
                                    map.flyTo({
                                        center: geo.geometry.coordinates,
                                        zoom: 16,
                                        essential: true
                                    });
                                    // var randomIndex = Math.floor(Math.random() * geo.length);
                                    // console.log(index);
                                    var popUps = document.getElementsByClassName(
                                        "mapboxgl-popup"
                                    );
                                    if (popUps[0]) popUps[0].remove();
                                    var popup = new mapboxgl.Popup({
                                        closeOnClick: true,
                                        offset: 10
                                    })
                                        .setLngLat(geo.geometry.coordinates)
                                        .setHTML(geo.properties.flyLoc)
                                        .addTo(map);
                                }, 5000 * index);
                            });
                            // var index = this.items.findIndex((obj) => obj.id == idx);
                            // var popUpLanding = this.items[index].latLong;
                            // var nama = this.items[index].name;
                            // var url = this.items[index].url;
                            // var popsups = `<video id ='my-video' class='video-js vjs-default-skin vjs-big-play-centered popup-img vidcctv' preload='auto' autoplay controls data-setup='{}'>
                            // 		<source type='application/x-mpegURL' src='${url}'>
                            //   </video><br/>`;
                            // // console.log(aha);
                        });
                    }
                );
            });
        });
    }
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
