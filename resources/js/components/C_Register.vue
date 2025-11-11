<template>
    <div>
        <div class="register-page-container" style="overflow: hidden">
            <div class="register-container">
                <el-row>
                    <el-col :span="12">
                        <div class="set-img-profile-left">
                            <img class="imgContLeft" src="/assets/tf5.jpg" />
                        </div>
                    </el-col>
                    <el-col :span="12" :xs="24">
                        <div class="form-content">
                            <div class="webgis">Web<span>GIS</span></div>
                            <el-form
                                class="register-form"
                                :label-position="labelPosition"
                                label-width="100px"
                                :model="formLabelAlign"
                            >
                                <el-row>
                                    <el-col :span="24">
                                        <el-form-item>
                                            <el-input
                                                v-model="
                                                    formLabelAlign.fullname
                                                "
                                                placeholder="Full name"
                                            ></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                <el-row>
                                    <el-col :span="24">
                                        <el-form-item>
                                            <el-input
                                                v-model="formLabelAlign.email"
                                                type="email"
                                                placeholder="Email"
                                            ></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                <el-row>
                                    <el-col :span="12" :xs="24">
                                        <el-form-item>
                                            <el-input
                                                v-model="formLabelAlign.pass"
                                                type="password"
                                                placeholder="Password"
                                            ></el-input>
                                        </el-form-item>
                                    </el-col>
                                    <el-col :span="12" :xs="24">
                                        <el-form-item>
                                            <el-input
                                                v-model="formLabelAlign.conPass"
                                                type="password"
                                                placeholder="Confirm password"
                                            ></el-input>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                                <el-row>
                                    <el-col :span="24">
                                        <el-form-item>
                                            <!-- <div class="btn-form-submit">
                      <el-button type="info">Discard</el-button>
                      <el-button type="primary" @click="onSubmit"
                        >Update</el-button
                      >
                    </div> -->
                                            <div
                                                class="btn-form-submit back-btn"
                                            >
                                                <el-button type="primary"
                                                    >Register</el-button
                                                >
                                            </div>
                                            <a href="#">
                                                <div class="forgot-password">
                                                    Forgot password?
                                                </div>
                                            </a>
                                            <div class="register">
                                                <span style="opacity: 0.5">
                                                    Already have an account? </span
                                                ><a
                                                    href="/login"
                                                    style="color: var(--text-color)"
                                                    >Log in!</a
                                                >
                                            </div>
                                        </el-form-item>
                                    </el-col>
                                </el-row>
                            </el-form>
                        </div>
                    </el-col>
                </el-row>
                <!-- <div class="set-img-profile-left">
          <img class="imgContLeft" src="/assets/tf5.jpg" />
        </div> -->
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            labelPosition: "top",
            formLabelAlign: {
                fullname: "",
                email: "",
                pass: "",
                conPass: ""
            }
        };
    },
    methods: {
        onSubmit() {
            console.log("submit!");
        },
        handleAvatarSuccess(res, file) {
            this.imageUrl = URL.createObjectURL(file.raw);
        },
        beforeAvatarUpload(file) {
            const isJPG = file.type === "image/jpeg";
            const isLt2M = file.size / 1024 / 1024 < 2;

            if (!isJPG) {
                this.$message.error("Avatar picture must be JPG format!");
            }
            if (!isLt2M) {
                this.$message.error("Avatar picture size can not exceed 2MB!");
            }
            return isJPG && isLt2M;
        }
    },

    mounted() {}
};
</script>

<style>
.register-container {
    left: 50%;
    transform: translateX(-50%);
    position: relative;
    width: 80%;
    height: 100%;
    /*   padding: 40px; */
    background-color: var(--color-secondary);
    border-radius: 10px;
    box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}
.register-container .form-content {
    padding: 80px 50px;
    padding-left: 80px;
    transform: translateX(100%);
}
.webgis {
    margin-bottom: 20px;
    font-size: var(--size-xl);
    font-weight: 400;
    text-align: center;
    margin-bottom: 30px;
    padding-right: 30px;
    color: var(--text-color);
}

.webgis span {
    color: var(--green-theme);
    font-weight: 700;
    font-size: var(--size-lg);
}

.forgot-password,
.register {
    text-align: center;
    color: var(--text-color);
}
.forgot-password {
    margin-top: 10px;
}
.register {
    margin-top: -10px;
}
.register-form .el-input__inner {
    margin-bottom: 10px;
}

.register-form .el-input__inner,
.register-form .el-select {
    width: 100%;
}
.register-container .el-form-item {
    width: 100%;
    margin-bottom: 10px;
    padding-right: 30px;
}
.register-container .el-input__inner {
    width: 100%;
    height: 40px;
}
.btn-form-submit {
    margin-top: 20px;
    display: flex-end;
}
.set-img-profile-left {
    opacity: 1;
    visibility: visible;
    position: absolute;
    background: white;
    display: flex;
    align-items: center;
    border-radius: 10px;
    overflow: hidden;
    height: 100%;
    width: 50%;
    top: 0;
    left: 0;
    box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
    -webkit-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
    -moz-box-shadow: -10px 0 20px rgba(29, 29, 29, 0.2);
    transition: all 0.5s ease;
}
.set-img-profile-left .imgContLeft {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    -o-object-fit: cover;
    object-fit: cover;
    position: absolute;
    transition: all 0.5s ease;
}
.set-img-profile-left:hover .imgContLeft {
    transform: scale(1.25);
}
.mapboxgl-ctrl-attrib.mapboxgl-compact {
    display: none;
}
@media screen and (max-width: 992px) {
}
@media screen and (max-width: 600px) {
    .register-container .form-content {
        transform: translateX(0);
    }
    .set-img-profile-left {
        opacity: 0;
        visibility: hidden;
    }
}
</style>
