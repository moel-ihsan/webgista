<template>
  <div id="right" class="sidebar flex-center right" :class="{ collapsed: isCollapsed }">
    <div class="sidebar-content rounded-rect">
      <el-input
        :value="filterText"
        placeholder="Please input"
        @input="$emit('update:filter-text', $event)"
      />
      <div class="search-card-item">
        <div v-for="item in items" :key="item.id">
          <div class="search-card">
            <div :id="item.id" class="search-info-card" @click="$emit('select', item.id)">
              <div class="search-content">
                <div class="name">{{ item.name }}</div>
                <div class="coordinate">{{ item.coordinate }}</div>
                <div v-if="item.address.length > 25" class="address">
                  {{ item.address.substr(0, 25) }} . . .
                </div>
                <div v-else class="address">{{ item.address }}</div>
                <el-button
                  class="detail"
                  :type="item.status === 'Regular' ? 'danger' : 'warning'"
                  round
                >
                  {{ item.status }}
                </el-button>
              </div>
              <div class="search-icon">
                <img class="search-img" :src="item.imageUrl" />
              </div>
            </div>
          </div>
        </div>
        <div v-if="items.length === 0">
          <div class="search-info-card no-data-match">No Data</div>
        </div>
      </div>
      <div id="mapSeacrh" class="sidebar-toggle rounded-rect right" @click="$emit('toggle')">
        <ion-icon v-if="isCollapsed === false" name="close" />
        <ion-icon v-else name="search" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "MapSearchSidebar",
  props: {
    items: {
      type: Array,
      default: () => []
    },
    filterText: {
      type: String,
      default: ""
    },
    isCollapsed: {
      type: Boolean,
      default: true
    }
  }
};
</script>

<style>
.search-card-item {
  margin-top: 10px;
  margin-bottom: 20px;
  height: 95%;
  border-radius: 0px 0px 10px 10px;
  overflow: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.search-card-item::-webkit-scrollbar {
  width: 5px;
}

.search-card-item::-webkit-scrollbar-track {
  background: transparent;
}

.search-card-item::-webkit-scrollbar-thumb {
  background-color: rgba(var(--green-theme), 0.8);
  border-radius: 20px;
  border: none;
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

.no-data-match {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--size-lg);
  font-weight: 600;
  color: var(--green-theme);
}
</style>
