<template>
    <div>
        <div class="huhu">
            <el-menu
                class="el-menu-demo"
                mode="horizontal"
                @select="handleSelect"
                background-color="transparent"
            >
                <el-menu-item class="pageTitle" disabled>{{
                    title
                }}</el-menu-item>
                <div class="nav-right">
                    <el-menu-item index="2" disabled
                        ><el-switch
                            v-model="themeSetting"
                            active-color="white"
                            inactive-color="#27293d"
                        >
                        </el-switch
                    ></el-menu-item>
                    <!-- <el-menu-item index="3" disabled>
            <ion-icon name="help-circle-outline"></ion-icon>
          </el-menu-item> -->
                    <a href="/login" v-if="role != 'admin'">
                        <el-menu-item index="3" disabled>
                            <div class="" style="cursor: pointer">Login</div>
                        </el-menu-item>
                    </a>
                    <el-submenu index="4" v-if="role == 'admin'">
                        <template slot="title"
                            ><el-avatar
                                :size="40"
                                :src="'/storage/' + circleUrl"
                            ></el-avatar
                        ></template>
                        <a :href="'/profile/' + id">
                            <el-menu-item index="2-1">
                                <ion-icon
                                    name="person-circle"
                                    style="margin-right: 10px"
                                ></ion-icon
                                >Edit Profile</el-menu-item
                            ></a
                        >
                        <a href="/password">
                            <el-menu-item index="2-2">
                                <ion-icon
                                    name="lock-closed"
                                    style="
                    margin-right: 10px;
                    margin-left: 3px;
                    font-size: 18.9px !important;
                  "
                                ></ion-icon
                                >Change Password</el-menu-item
                            >
                        </a>
                    </el-submenu>
                </div>
            </el-menu>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        propsTitle: {
            required: true
        }
    },
    data() {
        return {
            circleUrl: "avatar.jpg",
            activeIndex: "1",
            activeIndex2: "1",
            themeSetting: true,
            title: "",
            role: "",
            id: ""
        };
    },
    created() {
        this.fetchUser();
        this.title = this.propsTitle ?? "UNKNOWN";
    },
    methods: {
        fetchUser() {
            axios
                .get("/authUser")
                .then(res => {
                    this.circleUrl = res.data.user.profile_photo_path;
                    this.role = res.data.user.role;
                    this.id = res.data.user.id;
                })
                .catch(err => console.log(err));
        },
        handleSelect(key, keyPath) {
            console.log(key, keyPath);
        }
    },
    mounted() {}
};
</script>

<style>
.pageTitle {
    font-size: var(--size-lg) !important;
}

.el-submenu__title,
.el-submenu__title:hover,
.el-submenu__title:focus {
    opacity: 1 !important;
    cursor: pointer;
    color: var(--text-color) !important;
    border-bottom-color: transparent;
    background-color: transparent !important;
    font-size: var(--size-md);
}

.el-menu.el-menu--horizontal {
    border-bottom: none;
}

.el-menu-item.is-disabled {
    opacity: 1 !important;
    cursor: default;
    color: var(--text-color) !important;
    border-bottom-color: transparent;
    background-color: transparent !important;
    font-size: var(--size-md);
}
ul {
    padding: 0.5em 0;
}
.el-header {
    padding: 0px;
    box-sizing: border-box;
    flex-shrink: 0;
}
.nav-right {
    display: flex;
    justify-content: flex-end;
}
.el-switch .el-switch__core::after {
    background-color: white;
}
.el-switch.is-checked .el-switch__core::after {
    background-color: #27293d;
}

.el-submenu__icon-arrow {
    display: none;
}

ion-icon {
    font-size: var(--size-xl);
}

.el-menu--popup {
    right: 40px !important;
    background-color: var(--color-secondary) !important;
    padding: 5px 0;
    border-radius: 10px;
}

.el-menu--popup .el-menu-item {
    font-size: var(--size-sm);
}

.el-menu--popup .el-menu-item:hover,
.el-menu--popup .el-menu-item.is-active,
.el-menu--popup .el-menu-item:focus {
    background-color: transparent !important;
    color: var(--text-color) !important;
}

.pageTitle {
    display: block;
    transition: 0.5s;
}

.el-menu--horizontal > .el-menu-item.is-active {
    border-bottom: none;
    color: #303133;
}

@media screen and (max-width: 992px) {
    .pageTitle {
        display: block;
        transition: 0.5s;
    }
}

@media screen and (max-width: 600px) {
    .pageTitle {
        display: none;
    }
}
</style>
