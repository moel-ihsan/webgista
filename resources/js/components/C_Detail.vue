<template>
    <div>
        <el-row :gutter="30">
            <el-col :span="15" :xs="24" :md="24" :lg="15">
                <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
                    <video
                        class="videoCCTV"
                        controls
                        autoplay
                        v-if="formLabelAlign.category == 'Analytic'"
                    >
                        <source :src="formLabelAlign.url" type="video/mp4" />
                    </video>
                    <div
                        class="cardVideoCCTV"
                        v-if="formLabelAlign.category == 'Regular'"
                    >
                        <img
                            :src="'/storage/' + imageUrl"
                            height="100%"
                            width="100%"
                            style="object-fit:cover"
                        />
                    </div>
                </el-card>
            </el-col>
            <el-col :span="9" :xs="24" :md="24" :lg="9">
                <el-card :body-style="{ padding: '0px' }" class="cardOffice">
                    <div class="imgBox cctvThumbnail">
                        <img class="imgCont" :src="'/storage/' + imageUrl" />
                        <div class="cctvStatus">
                            <el-tag
                                :type="
                                    formLabelAlign.category === 'Regular'
                                        ? 'primary'
                                        : 'success'
                                "
                                disable-transitions
                                >{{ formLabelAlign.category }}</el-tag
                            >
                        </div>
                    </div>
                    <div style="padding-top: 14px">
                        <div class="cctvName">{{ formLabelAlign.name }}</div>
                        <div class="cctvAddress">
                            {{ formLabelAlign.address }}
                        </div>
                        <div class="cctvCoordinate">
                            {{ formLabelAlign.longitude }} E
                            {{ formLabelAlign.lattitude }} N
                        </div>
                        <div class="cctvAgency">
                            {{ formLabelAlign.agency }} Agent
                        </div>
                    </div>
                    <div class="imgBox mapBox" style="margin-top: 20px">
                        <div id="map"></div>
                    </div>
                    <div class="btn-form-submit back-btn">
                        <el-button type="info" @click="handleCancel"
                            >Back</el-button
                        >
                    </div>
                </el-card>
            </el-col>
        </el-row>
    </div>
</template>

<script>
import mapboxgl from "mapbox-gl";

export default {
    name: "mapBox",
    props: {
        cctv: { type: Object }
    },
    data() {
        return {
            accessToken:
                "pk.eyJ1IjoibW9lbC1paHNhbiIsImEiOiJjazljdmFhNzYwNnV2M21yM3IxaHgwamVnIn0.suuGn0UAUi-ud4rV2QCe4Q",
            formLabelAlign: {
                name: "",
                category: "",
                cctvImage: "",
                address: "",
                lattitude: "",
                longitude: "",
                agency: "",
                car: "",
                motor: "",
                url: ""
            },
            imageUrl: ""
        };
    },
    created() {
        this.formLabelAlign.name = this.cctv.name;
        this.formLabelAlign.category = this.cctv.category;
        this.formLabelAlign.cctvImage = this.cctv.path_img;
        this.formLabelAlign.address = this.cctv.address;
        this.formLabelAlign.lattitude = this.cctv.lattitude;
        this.formLabelAlign.longitude = this.cctv.longitude;
        this.formLabelAlign.agency = this.cctv.agency;
        this.formLabelAlign.url = this.cctv.url;
        // this.formLabelAlign.car = this.cctv.car;
        // this.formLabelAlign.motor = this.cctv.motor;
        this.imageUrl = this.cctv.path_image;
    },
    methods: {
        // draw(element) {
        //   // var w = element.offsetWidth;
        //   // var h = element.offsetHeight;
        //   var cv = document.getElementById("cv1");
        //   // console.log(w);
        //   // cv.width = w;
        //   // cv.height = h;

        //   if (cv.getContext) {
        //     var ctx = cv.getContext("2d");

        //     // Stroked triangle
        //     ctx.beginPath();
        //     ctx.moveTo(125, 125);
        //     ctx.lineTo(200, 100);
        //     ctx.lineTo(200, 50);
        //     ctx.lineTo(150, 50);
        //     // ctx.lineTo(100, 100);
        //     // ctx.lineTo(45, 125);
        //     ctx.closePath();
        //     ctx.stroke();
        //   }
        // },
        // handleVideo() {
        //   var model = undefined;
        //   var video = document.getElementById("my-video");
        //   var totalMobil = 0;
        //   var totalMotor = 0;
        //   var mobil = 0;
        //   var motor = 0;
        //   var totalKendaraan = 0;
        //   // console.log(video);
        //   var canvasv = document.createElement("canvas");
        //   const imgTag = document.createElement("img");
        //   var ctx = canvasv.getContext("2d");

        //   const initModel = async () => {
        //     canvasv.width = video.videoWidth;
        //     canvasv.height = video.videoHeight;
        //     video.playbackRate = 2;
        //     model = await modelPromise;
        //     console.log("model loaded");
        //   };

        //   var d = new Date();
        //   var n = d.getSeconds();
        //   var intervalSecond = 0;

        //   video.addEventListener("loadeddata", initModel);

        //   video.addEventListener("timeupdate", function () {
        //     if (n != new Date().getSeconds) {
        //       intervalSecond++;
        //     }

        //     if (intervalSecond == 100) {
        //       intervalSecond = 0;
        //       totalKendaraan = mobil + motor;
        //       console.log("total 10 detik = " + totalKendaraan);
        //       mobil = 0;
        //       motor = 0;
        //     }
        //     var marginKanvas = canvasv.height - 150;
        //     ctx.drawImage(this, 0, marginKanvas, canvasv.width, 150);
        //     // console.log(canvasv.width);
        //     // ctx.drawImage(this, 0, 0);

        //     canvasv.toBlob(function (blob) {
        //       imgTag.src = URL.createObjectURL(blob);

        //       imgTag.onload = async () => {
        //         if (model) {
        //           const results = await model.detect(imgTag);
        //           const cars = ["truck", "bus", "car"];
        //           const bikes = ["person", "motorcycle", "bicycle"];
        //           results.forEach((result) => {
        //             if (cars.includes(result.class)) {
        //               totalMobil++;
        //               console.log(totalMobil);
        //               // mobil++;
        //               document.getElementById(
        //                 "result-car"
        //               ).innerText = `${totalMobil}`;
        //             } else if (bikes.includes(result.class)) {
        //               totalMotor++;
        //               // motor++;
        //               document.getElementById(
        //                 "result-motor"
        //               ).innerText = `${totalMotor}`;
        //             }
        //             // console.log(result.class);
        //           });
        //         }
        //         URL.revokeObjectURL(imgTag.src);
        //       };
        //     }, "image/jpeg");
        //   });
        // },
        handleCancel() {
            window.history.back();
        }
    },
    mounted() {
        // this.draw();
        // this.handleVideo();
        mapboxgl.accessToken = this.accessToken;
        var centerMap = [
            this.formLabelAlign.longitude,
            this.formLabelAlign.lattitude
        ];

        var map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v11",
            center: centerMap,
            minZoom: 2,
            zoom: 12,
            interactive: false
        });

        var nameCCTV = this.formLabelAlign.name;
        var popup = new mapboxgl.Popup({ closeOnClick: false, offset: 15 })
            .setLngLat(centerMap)
            .setHTML(`<h1 id='isi'>${nameCCTV}</h1>`)
            .addTo(map);

        var size = 100;

        // implementation of CustomLayerInterface to draw a pulsing dot icon on the map
        // see https://docs.mapbox.com/mapbox-gl-js/api/#customlayerinterface for more info
        var pulsingDot = {
            width: size,
            height: size,
            data: new Uint8Array(size * size * 4),

            // get rendering context for the map canvas when layer is added to the map
            onAdd: function() {
                var canvas = document.createElement("canvas");
                canvas.width = this.width;
                canvas.height = this.height;
                this.context = canvas.getContext("2d");
            },

            // called once before every frame where the icon will be used
            render: function() {
                var duration = 1000;
                var t = (performance.now() % duration) / duration;

                var radius = (size / 2) * 0.3;
                var outerRadius = (size / 2) * 0.7 * t + radius;
                var context = this.context;

                // draw outer circle
                context.clearRect(0, 0, this.width, this.height);
                context.beginPath();
                context.arc(
                    this.width / 2,
                    this.height / 2,
                    outerRadius,
                    0,
                    Math.PI * 2
                );
                context.fillStyle = "rgba(255, 200, 200," + (1 - t) + ")";
                context.fill();

                // draw inner circle
                context.beginPath();
                context.arc(
                    this.width / 2,
                    this.height / 2,
                    radius,
                    0,
                    Math.PI * 2
                );
                context.fillStyle = "rgba(255, 100, 100, 1)";
                context.strokeStyle = "white";
                context.lineWidth = 2 + 4 * (1 - t);
                context.fill();
                context.stroke();

                // update this image's data with data from the canvas
                this.data = context.getImageData(
                    0,
                    0,
                    this.width,
                    this.height
                ).data;

                // continuously repaint the map, resulting in the smooth animation of the dot
                map.triggerRepaint();

                // return `true` to let the map know that the image was updated
                return true;
            }
        };

        map.on("load", function() {
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
                                coordinates: centerMap
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
    }
};
</script>

<style>
.canvas {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 10;
    background-color: rgba(255, 0, 0, 0);
}

#isi {
    font-weight: 500;
    font-size: var(--size-md);
    display: inline-block;
}

.cardVideoCCTV {
    border-radius: 10px;
    border: none;
    height: 550px;
    overflow: hidden;
    position: relative;
    margin-bottom: 50px;
    transition: all 0.5s ease;
}

.is-always-shadow {
    border: none;
    box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
    -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
    -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 1);
}

.videoCCTV {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -o-object-fit: cover;
    object-fit: cover;
    position: absolute;
    z-index: 10;
    transition: all 0.5s ease;
}

.nameCCTV {
    color: white;
    font-size: var(--size-lg);
}
.addressCCTV {
    color: #32e18c;
    font-size: var(--size-sm);
}

.cardOffice {
    background-color: var(--color-secondary);
    padding: 15px;
    border-radius: 10px;
    border: none;
    overflow: hidden;
    position: relative;
    cursor: default;
    transition: all 0.5s ease;
}

.imgBox {
    border-radius: 10px;
    border: none;
    height: 200px;
    overflow: hidden;
    box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
    position: relative;
    transition: all 0.5s ease;
}

.imgBox.cctvThumbnail {
    height: 150px;
}

.imgBox.cctvThumbnail:before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    opacity: 0.5;
    height: 50%;
    width: 100%;
    z-index: 1;
    background: linear-gradient(
        45deg,
        rgba(13, 13, 13, 0) 0%,
        rgba(7, 7, 7, 1) 100%
    );
    mix-blend-mode: multiply;
    transition: all 0.5s ease;
}

.imgBox:hover.cctvThumbnail:before {
    opacity: 0.8;
}

.imgBox .imgCont {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -o-object-fit: cover;
    object-fit: cover;
    position: absolute;
    transition: all 0.5s ease;
}

.imgBox:hover {
    transform: scale(0.98);
    z-index: 1;
}

.imgBox.mapBox:hover {
    transform: none;
    z-index: 1;
}

.imgBox.mapBox {
    height: 200px;
}

.imgBox:hover .imgCont {
    transform: scale(1.25);
}

.cctvName {
    font-size: var(--size-md);
    color: var(--text-color);
    font-weight: 500;
}

.cctvAddress {
    font-size: var(--size-xs);
    color: var(--text-color);
}

.cctvCoordinate {
    font-size: var(--size-xs);
    color: var(--green-theme);
}

.cctvAgency {
    font-size: var(--size-xs);
    color: var(--text-color);
}

.cctvStatus {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1;
}

.btn-form-submit.back-btn .el-button {
    width: 100%;
}
</style>
