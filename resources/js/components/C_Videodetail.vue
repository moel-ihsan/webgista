<template>
    <div>
        <el-row :gutter="30" style="margin-top: 20px">
            <el-col :span="15" :xs="24" :md="24" :lg="15">
                <el-card :body-style="{ padding: '0px' }" class="cardVideoCCTV">
                    <video
                        id="my-video"
                        class="video-js vjs-default-skin vjs-big-play-centered videoCCTV"
                        preload="auto"
                        autoplay
                        controls
                        data-setup="{}"
                        style="display: none"
                    >
                        <source
                            v-if="`${formVehLabel.host}` == 'www.youtube.com'"
                            :src="formVehLabel.url"
                            type="video/youtube"
                        />
                        <source
                            v-else
                            :src="formVehLabel.url"
                            type="video/mp4"
                        />
                        <!-- <source type="application/x-mpegURL" :src="formLabelAlign.url" /> -->
                    </video>
                    <canvas
                        id="canvasx"
                        class="videoCCTV"
                        style="display: block; z-index: 12"
                    ></canvas>
                    <canvas
                        id="canvasv"
                        class="videoCCTV"
                        style="
              display: block;
              background-color: rgba(0, 0, 0, 0);
              z-index: 11;
            "
                    ></canvas>
                    <canvas
                        id="canvasy"
                        class="videoCCTV"
                        style="display: block; z-index: 10"
                    ></canvas>
                </el-card>
                <div class="btn-video">
                    <button
                        v-if="areaVideo == true"
                        id="btn-manage"
                        type="button"
                        class="el-button el-button--primary"
                        @click="manageVideo()"
                    >
                        Manage Video
                    </button>
                    <button
                        v-else
                        id="btn-drop"
                        type="button"
                        class="el-button el-button--primary"
                        @click="manageVideo()"
                    >
                        Done
                    </button>

                    <button
                        v-if="oriVideo == true"
                        id="btn-show"
                        type="button"
                        class="el-button el-button--primary"
                        @click="showVideo()"
                    >
                        Show Video
                    </button>
                    <button
                        v-else
                        id="btn-hide"
                        type="button"
                        class="el-button el-button--primary"
                        @click="showVideo()"
                    >
                        Hide Video
                    </button>
                </div>

                <canvas id="canvasw" class="canvasw"></canvas>
            </el-col>
            <el-col :span="9" :xs="24" :md="24" :lg="9">
                <el-row
                    :gutter="30"
                    style="padding-left: 15px; padding-right: 15px; margin-bottom: 20px"
                >
                    <el-col :span="16" :xs="16">
                        <p>{{ formVehLabel.name }}</p>
                    </el-col>
                    <el-col :span="8" :xs="8">
                        <el-switch
                            class="nav-right"
                            v-model="themeSetting"
                            active-color="white"
                            inactive-color="#27293d"
                        >
                        </el-switch
                    ></el-col>
                </el-row>
                <el-form
                    class="veh-form"
                    :model="formVehLabel"
                    ref="formVehLabel"
                    :rules="rules"
                >
                    <el-col :span="24" :xs="24">
                        <div class="veh-info-card motor">
                            <div class="veh-content">
                                <div class="veh">Light Vehicle (LV)</div>
                                <div class="total" id="result-car">0</div>
                            </div>
                        </div>
                        <div class="veh-info-card motor">
                            <div class="veh-content">
                                <div class="veh">Heavy Vehicle (HV)</div>
                                <div class="total" id="result-truck">0</div>
                            </div>
                        </div>
                        <div
                            class="veh-info-card motor"
                            style="margin-top: 20px"
                        >
                            <div class="veh-content">
                                <div class="veh">Motorcycle (MC)</div>
                                <div class="total" id="result-motor">0</div>
                            </div>
                        </div>
                        <div
                            class="veh-info-card motor"
                            style="margin-top: 20px"
                        >
                            <div class="veh-content">
                                <div class="veh">Traffic Condition</div>
                                <div class="veh" id="result-kendaraan">
                                    No Data
                                </div>
                            </div>
                        </div>
                    </el-col>
                </el-form>
            </el-col>
        </el-row>
    </div>
</template>

<script>
export default {
    props: {
        cctv: { type: Object },
        csrf: { type: String }
    },
    data() {
        return {
            oriVideo: true,
            areaVideo: true,
            themeSetting: true,
            accessToken:
                "pk.eyJ1IjoibW9lbC1paHNhbiIsImEiOiJjazljdmFhNzYwNnV2M21yM3IxaHgwamVnIn0.suuGn0UAUi-ud4rV2QCe4Q",
            formVehLabel: {
                id: 0,
                name: "",
                url: "",
                host: "",
                keterangan: "",
                rec1x: "",
                rec1y: "",
                rec2x: "",
                rec2y: "",
                rec3x: "",
                rec3y: "",
                rec4x: "",
                rec4y: "",
                rec5x: "",
                rec5y: ""
            },

            rules: {
                car: [
                    {
                        required: true,
                        // type: "text",
                        // message: "Input number",
                        trigger: "blur"
                    }
                ]
            },
            imageUrl: ""
        };
    },
    created() {
        this.formVehLabel.name = this.cctv.name;
        this.formVehLabel.url = this.cctv.url;
        this.formVehLabel.keterangan = this.cctv.keterangan;
        this.formVehLabel.id = this.cctv.id;
        this.formVehLabel.rec1x = this.cctv.rec1x;
        this.formVehLabel.rec1y = this.cctv.rec1y;
        this.formVehLabel.rec2x = this.cctv.rec2x;
        this.formVehLabel.rec2y = this.cctv.rec2y;
        this.formVehLabel.rec3x = this.cctv.rec3x;
        this.formVehLabel.rec3y = this.cctv.rec3y;
        this.formVehLabel.rec4x = this.cctv.rec4x;
        this.formVehLabel.rec4y = this.cctv.rec4y;
        this.formVehLabel.rec5x = this.cctv.rec5x;
        this.formVehLabel.rec5y = this.cctv.rec5y;
    },
    methods: {
        manageVideo() {
            var canvasw = document.getElementById("canvasw");

            if (this.areaVideo == true) {
                canvasw.style.display = "block";
                this.areaVideo = false;
            } else {
                canvasw.style.display = "none";
                this.areaVideo = true;
            }
        },
        showVideo() {
            var myVideo = document.getElementById("my-video");

            if (this.oriVideo == true) {
                myVideo.style.display = "block";
                myVideo.style.zIndex = "30";
                this.oriVideo = false;
            } else {
                myVideo.style.display = "none";
                myVideo.style.zIndex = "1";
                this.oriVideo = true;
            }
        },
        parseUrl() {
            var url0 = `${this.formVehLabel.url}`;
            const url1 = new URL(url0);
            this.formVehLabel.host = url1.hostname;
        },
        handleVideo() {
            let model = undefined;
            let video = document.getElementById("my-video");
            var canvasx = document.getElementById("canvasx");
            var canvasv = document.getElementById("canvasv");
            var canvasy = document.getElementById("canvasy");
            var canvasw = document.getElementById("canvasw");
            const imgTag = document.createElement("img");
            var ctv = canvasv.getContext("2d");
            var ctx = canvasx.getContext("2d");
            var cty = canvasy.getContext("2d");
            var ctw = canvasw.getContext("2d");

            const initModel = async () => {
                canvasv.width = video.videoWidth;
                canvasv.height = video.videoHeight;
                canvasx.width = video.videoWidth;
                canvasx.height = video.videoHeight;
                canvasy.width = video.videoWidth;
                canvasy.height = video.videoHeight;
                canvasw.width = video.videoWidth;
                canvasw.height = video.videoHeight;
                console.log(canvasv.height);
                console.log(canvasv.width);
                console.log(video.videoWidth);
                console.log(video.videoHeight);

                //yang ini yang digunakan
                ctv.save();
                ctv.beginPath();
                ctv.moveTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctv.lineTo(this.formVehLabel.rec2x, this.formVehLabel.rec2y);
                ctv.lineTo(this.formVehLabel.rec3x, this.formVehLabel.rec3y);
                ctv.lineTo(this.formVehLabel.rec4x, this.formVehLabel.rec4x);
                ctv.lineTo(this.formVehLabel.rec5x, this.formVehLabel.rec5y);
                ctv.lineTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctv.closePath();
                ctv.clip();

                //Draw region
                ctv.beginPath();
                ctv.moveTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctv.lineTo(this.formVehLabel.rec2x, this.formVehLabel.rec2y);
                ctv.lineTo(this.formVehLabel.rec3x, this.formVehLabel.rec3y);
                ctv.lineTo(this.formVehLabel.rec4x, this.formVehLabel.rec4x);
                ctv.lineTo(this.formVehLabel.rec5x, this.formVehLabel.rec5y);
                ctv.lineTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctv.closePath();
                ctv.lineWidth = 10;
                ctv.strokeStyle = "blue";
                ctv.stroke();

                //Draw region
                ctx.beginPath();
                ctx.moveTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctx.lineTo(this.formVehLabel.rec2x, this.formVehLabel.rec2y);
                ctx.lineTo(this.formVehLabel.rec3x, this.formVehLabel.rec3y);
                ctx.lineTo(this.formVehLabel.rec4x, this.formVehLabel.rec4x);
                ctx.lineTo(this.formVehLabel.rec5x, this.formVehLabel.rec5y);
                ctx.lineTo(this.formVehLabel.rec1x, this.formVehLabel.rec1y);
                ctx.closePath();
                ctx.lineWidth = 5;
                ctx.strokeStyle = "blue";
                ctx.stroke();

                model = await modelPromise;
                console.log("model loaded");
            };

            const id = this.formVehLabel.id;
            const csrf = this.csrf;
            video.addEventListener("loadeddata", initModel);
            video.addEventListener("timeupdate", function() {
                let totalMobil = 0;
                let totalMotor = 0;
                let totalTruk = 0;
                let totalKendaraan = 0;
                let bobotMobil = 0;
                let bobotMotor = 0;
                let bobotTruk = 0;

                cty.drawImage(this, 0, 0);
                ctv.drawImage(this, 0, 0);
                ctw.drawImage(this, 0, 0);

                canvasv.toBlob(function(blob) {
                    imgTag.src = URL.createObjectURL(blob);
                    imgTag.onload = async () => {
                        if (model) {
                            const results = await model.detect(imgTag);
                            const trucks = ["truck", "bus"];
                            const cars = "car";
                            const bikes = ["person", "motorcycle", "bicycle"];

                            results.forEach(result => {
                                let hasObject = false;
                                if (trucks.includes(result.class)) {
                                    hasObject = true;
                                    totalTruk++;
                                    document.getElementById(
                                        "result-truck"
                                    ).innerText = `${totalTruk}`;
                                } else if (bikes.includes(result.class)) {
                                    hasObject = true;
                                    totalMotor++;
                                    document.getElementById(
                                        "result-motor"
                                    ).innerText = `${totalMotor}`;
                                } else if (cars) {
                                    hasObject = true;
                                    totalMobil++;
                                    document.getElementById(
                                        "result-car"
                                    ).innerText = `${totalMobil}`;
                                }

                                if (hasObject) {
                                    ctv.beginPath();
                                    ctv.rect(...result.bbox);
                                    ctv.strokeStyle = "red";
                                    ctv.stroke();
                                    ctv.closePath();
                                }
                            });
                            bobotTruk = totalTruk * 0.13;
                            bobotMobil = totalMobil * 0.1;
                            bobotMotor = totalMotor * 0.04;
                            totalKendaraan =
                                (bobotTruk + bobotMobil + bobotMotor) /
                                (4455 / 3600);

                            if (totalKendaraan <= 0.6)
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Great";
                            else if (
                                totalKendaraan > 0.6 &&
                                totalKendaraan <= 0.7
                            )
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Good";
                            else if (
                                totalKendaraan > 0.7 &&
                                totalKendaraan <= 0.8
                            )
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Average";
                            else if (
                                totalKendaraan > 0.8 &&
                                totalKendaraan <= 0.9
                            )
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Poor";
                            else if (
                                totalKendaraan > 0.9 &&
                                totalKendaraan <= 1
                            )
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Bad";
                            else if (totalKendaraan > 1)
                                document.getElementById(
                                    "result-kendaraan"
                                ).innerText = "Terrible";
                            axios
                                .post(
                                    `/update/keterangan/${id}`,
                                    {
                                        keterangan: document.getElementById(
                                            "result-kendaraan"
                                        ).innerText
                                    },
                                    {
                                        headers: {
                                            "Csrf-Token": csrf
                                        }
                                    }
                                )
                                .then(response => {})
                                .catch(error => {
                                    console.log(error);
                                });
                        }

                        URL.revokeObjectURL(imgTag.src);
                    };
                    document.getElementById("result-truck").innerText = "0";
                    document.getElementById("result-motor").innerText = "0";
                    document.getElementById("result-car").innerText = "0";
                }, "image/jpeg");
            });
        },
        handleCancel() {
            window.history.back();
        }
    },
    mounted() {
        this.handleVideo();
        this.parseUrl();
    }
};
</script>

<style>
.btn-video {
    margin-top: -20px;
    margin-bottom: 20px;
}

.canvasw {
    background-color: var(--color-secondary);
    display: none;
    border-radius: 10px;
}
</style>
