<template>
    <div>
        <el-card :body-style="{ padding: '0px' }" class="cardOffice">
            <div class="imgBox">
                <img
                    class="imgCont"
                    :src="'/storage/' + users.profile_photo_path"
                />
            </div>
            <div style="padding-top: 14px">
                <div class="officeName">{{ users.name }}</div>
                <div class="officeAddress">{{ users.address }}</div>
                <div class="officeCoordinate">
                    {{ users.longitude }} E {{ users.lattitude }} N
                </div>
                <div class="officeDesc">{{ users.description }}</div>
                <div class="recent">
                    Recently Updated
                    <el-row :gutter="10" class="recentRow">
                        <cardRecent></cardRecent>
                    </el-row>
                </div>
            </div>
        </el-card>
    </div>
</template>

<script>
export default {
    props: {
        users: { type: Object }
    }

    // created() {
    //   // console.log("aningisn");
    //   this.fetchUser();
    // },
    // methods: {
    //   fetchUser() {
    //     console.log("tes");
    //     // axios.get("/login/enter").then((res) => {
    //     axios
    //       .get("/profileUser")
    //       .then((res) => {
    //         console.log(res.data);
    //         console.log("berhasul");
    //         // this.total = res.data.length;
    //         // res.data.forEach((row, index) => {
    //         //   this.users.push({
    //         //     name: row.name,
    //         //     email: row.email,
    //         //     address: row.address,
    //         //     lattitude: row.lattitude,
    //         //     longitude: row.longitude,
    //         //     description: row.description,
    //         //     profile_photo_path: row.profile_photo_path,
    //         //     role: row.role,
    //         //   });
    //         // console.log(row.name);
    //         // });
    //       })
    //       .catch((err) => console.log(err));
    //   },
    // },
};
</script>

<style>
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

.imgBox:hover .imgCont {
    transform: scale(1.25);
}

.officeName {
    font-size: var(--size-md);
    font-weight: 500;
    color: var(--text-color);
}

.officeAddress {
    font-size: var(--size-xs);
    color: var(--text-color);
}

.officeCoordinate {
    font-size: var(--size-xs);
    color: var(--green-theme);
    margin-bottom: 1.5em;
}

.officeDesc {
    font-size: var(--size-xs);
    color: var(--text-color);
    line-height: 1.5;
}

.recent {
    color: var(--text-color);
    font-size: var(--size-md);
    margin-top: 1.5em;
}

.cardRecent {
    margin-top: 0.5em;
}

@media screen and (max-width: 992px) {
    .cardOffice {
        margin-top: 30px;
    }
}
@media screen and (max-width: 600px) {
}
</style>
