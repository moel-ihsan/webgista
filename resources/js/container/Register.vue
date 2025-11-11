<template>
    <div>
        <el-container>
            <el-header class="topFix haha" height="5px"> </el-header>
        </el-container>
        <el-container>
            <el-header
                ><el-menu
                    :default-active="activeIndex2"
                    class="el-menu-demo"
                    mode="horizontal"
                    @select="handleSelect"
                    background-color="transparent"
                >
                    <div class="nav-right">
                        <el-menu-item index="2" disabled
                            ><el-switch
                                v-model="themeSetting"
                                active-color="white"
                                inactive-color="#27293d"
                            >
                            </el-switch
                        ></el-menu-item>
                        <el-menu-item index="3" disabled>
                            <ion-icon name="help-circle-outline"></ion-icon>
                        </el-menu-item>
                    </div> </el-menu
            ></el-header>
            <el-main>
                <cRegister></cRegister>
            </el-main>
            <el-footer></el-footer>
        </el-container>
    </div>
</template>

<style></style>

<script>
export default {
    data() {
        return {
            circleUrl: "https://source.unsplash.com/user/",
            activeIndex: "1",
            activeIndex2: "1",
            themeSetting: true
        };
    },
    methods: {
        handleSelect(key, keyPath) {
            console.log(key, keyPath);
        }
    }
};
</script>
