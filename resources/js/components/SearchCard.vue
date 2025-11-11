<template>
  <div>
    <!-- <el-input placeholder="Please input" v-model="filterState"></el-input>
    <div class="search-card-item">
      <div v-for="item in getItems" :key="item">
        <div class="search-card">
          <div class="search-info-card" :id="item.id">
            <div class="search-content">
              <div class="name">{{ item.name }}</div>
              <div class="coordinate">{{ item.coordinate }}</div>
              <div class="address">
                {{ item.address }}
              </div>
              <el-button
                :type="item.status === 'Regular' ? 'danger' : 'warning'"
                class="detail"
                round
                >{{ item.status }}</el-button
              >
            </div>
            <div class="search-icon">
              <img class="search-img" :src="'./assets/' + item.source" />
            </div>
          </div>
        </div>
      </div>
      <div v-if="getItems.length === 0">
        <div class="search-info-card no-data-match">No Data</div>
      </div>
    </div> -->
  </div>
</template>

<script>
// export default {
//   data() {
//     return {
//       items: [],
//       filterState: "",
//     };
//   },
//   created() {
//     this.fetchCctv();
//   },
//   methods: {
//     fetchCctv() {
//       axios.get("/api/table").then((res) => {
//         console.log(res.data);
//         // this.total = res.data.length;
//         res.data.forEach((row, index) => {
//           this.items.push({
//             id: row.id,
//             name: row.name,
//             address: row.address,
//             coordinate: `${row.lattitude} E ${row.longitude} N`,
//             status: row.category,
//             source: row.path_image,
//           });
//         });
//       });
//     },
//   },
//   computed: {
//     getItems() {
//       var items = this.items.filter((item) => {
//         return (
//           item.name.toLowerCase().includes(this.filterState.toLowerCase()) ||
//           item.address.toLowerCase().includes(this.filterState.toLowerCase()) ||
//           item.status.toLowerCase().includes(this.filterState.toLowerCase())
//         );
//       });
//       return items;
//     },
//   },
// };
//
</script>


<style >
.el-input__inner {
  -webkit-appearance: none;
  background-color: var(--color-secondary);
  background-image: none;
  border-radius: 10px;
  border: 1px solid var(--color-secondary);
  box-sizing: border-box;
  color: var(--text-color);
  display: inline-block;
  font-size: inherit;
  height: 29px;
  line-height: 29px;
  outline: 0;
  padding: 0 15px;
  transition: border-color 0.2s cubic-bezier(255, 255, 2555, 1);
  width: 90%;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}
.el-input__inner:hover,
.el-input__inner:focus {
  border-color: var(--green-theme);
}
.el-input__inner::-moz-placeholder {
  color: rgba(var(--text-color), 0.5);
}
.el-input__inner:-ms-input-placeholder {
  color: rgba(var(--text-color), 0.5);
}
.el-input__inner::placeholder {
  color: rgba(var(--text-color), 0.5);
}
.el-input.is-active .el-input__inner,
.el-input__inner:focus {
  outline: 0;
}
.search-card-item {
  margin-top: 10px;
  margin-bottom: 20px;
  height: 95%;
  border-radius: 0px 0px 10px 10px;
  /* overflow-x: hidden;
  overflow-y: auto; */
  /* overflow: auto; */
  overflow: auto;
  -ms-overflow-style: none; /* IE 11 */
  scrollbar-width: none; /* Firefox 64 */
}
.search-card-item::-webkit-scrollbar {
  width: 5px; /* width of the entire scrollbar */
}
.search-card-item::-webkit-scrollbar-track {
  background: transparent; /* color of the tracking area */
}
.search-card-item::-webkit-scrollbar-thumb {
  background-color: rgba(
    var(--green-theme),
    0.8
  ); /* color of the scroll thumb */
  border-radius: 20px; /* roundness of the scroll thumb */
  border: none; /* creates padding around scroll thumb */
}

.search-info-card {
  margin-top: 15px;
  position: relative;
  font-size: var(--size-md);
  cursor: default;
  background-color: var(--color-secondary);
  color: var(--text-color);
  height: 120px;
  border-radius: 10px;
  width: 90%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.search-info-card:hover {
  cursor: pointer;
}

.search-info-card.no-data-match:hover {
  cursor: default;
}
.search-icon {
  width: 80px;
  border-radius: 10px;
  border: none;
  position: absolute;
  height: 80%;
  margin-left: 80%;
  justify-content: end;
  overflow: hidden;
}
.search-info-card .search-img {
  border-radius: 10px;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
  object-fit: cover;
  position: absolute;
  transition: 0.5s;
  box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
  -webkit-box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
  -moz-box-shadow: -3px 3px 6px rgba(29, 29, 29, 0.3);
}

.search-info-card:hover .search-img {
  transform: scale(1.2);
}

.search-content {
  position: relative;
  width: 80%;
  left: 0;
  padding: 10px;
  line-height: 20px;
}

.name {
  font-size: var(--size-md);
  font-weight: 600;
  color: var(--text-color);
}

.coordinate {
  opacity: 0.5;
  font-style: italic;
  font-size: var(--size-md);
  color: var(--text-color);
  transition: 0.5s;
}

.search-info-card:hover .coordinate {
  color: var(--green-theme);
  opacity: 1;
}

.address {
  color: var(--text-color);
  font-size: var(--size-md);
  transition: 0.5s;
  line-height: 15px;
}

.detail {
  margin-top: 10px;
}

.el-button.is-round {
  border-radius: 20px;
  padding: 5px 20px;
  font-size: var(--size-md);
}

.no-data-match {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--size-lg);
  font-weight: 600;
  color: var(--green-theme);
}
</style>
