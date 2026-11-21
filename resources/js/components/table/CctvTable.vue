<template>
  <div class="table-container">
    <div class="controller">
      <el-select v-model="value" size="mini" class="count-table" @change="handleFilter">
        <el-option
          v-for="item in pages"
          :key="item.value"
          :label="item.label"
          :value="item.value"
          size="mini"
        />
      </el-select>
      <el-input v-model="search" class="table-search" size="mini" placeholder="Type to search" />
    </div>
    <el-table
      v-loading="loading"
      empty-text="No Data"
      element-loading-spinner="oke"
      :data="filteredRows"
      style="width: 100%"
    >
      <el-table-column label="Name" prop="name" min-width="100" sortable>
        <template slot-scope="scope">
          <div style="display: flex; flex-direction: row">
            <el-avatar style="margin-right: 10px" size="large" :src="scope.row.cctvimg" />
            <div class="cctv-name">
              <div prop="name">{{ scope.row.name }}</div>
              <div class="time-table" prop="time">{{ scope.row.time }}</div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Address" prop="address" sortable>
        <template slot-scope="scope">
          <div v-if="scope.row.address.length > 20">
            <el-tooltip placement="top">
              <div slot="content">{{ scope.row.address }}</div>
              <div class="hdd taddress" style="margin-left: -11px">
                {{ scope.row.address.substr(0, 20) }} . . .
              </div>
            </el-tooltip>
          </div>
          <div v-else>{{ scope.row.address }}</div>
        </template>
      </el-table-column>
      <el-table-column label="Coordinate" prop="coordinate" sortable />
      <el-table-column label="Agency" prop="agency" sortable />
      <el-table-column label="Status" prop="status" sortable width="100">
        <template slot-scope="scope">
          <el-tag
            :type="scope.row.status === 'Regular' ? 'primary' : 'success'"
            disable-transitions
          >
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column align="center">
        <template slot="header">
          <a v-if="role === 'admin'" href="/table/add">
            <el-button type="info" class="detail" icon="el-icon-plus" round>Add New</el-button>
          </a>
        </template>
        <template slot-scope="scope">
          <div class="action-table">
            <a :href="'/detail/' + scope.row.id">
              <ion-icon name="eye" />
            </a>
            <a v-if="role === 'admin'" :href="'/table/edit/' + scope.row.id">
              <ion-icon name="pencil" />
            </a>
            <el-button
              v-if="role === 'admin'"
              type="text"
              size="small"
              @click.native.prevent="deleteRow(scope.$index, scope.row.id)"
            >
              <ion-icon class="remove" name="close" type="text" />
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <div class="table-footer">
      <div class="info-table" style="font-size: var(--size-sm); color: var(--green-theme)">
        Showing {{ total === 0 ? 0 : showIndex + 1 }} To {{ lastIndex }} Of {{ total }} Entries
      </div>
      <el-pagination
        class="pagination-table"
        background
        layout="prev, pager, next"
        :total="total"
        :page-size="showDataSize"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script>
import { fetchAuthUser } from "../../services/api/authApi";
import { fetchAll as fetchCctvPoints, remove as deleteCctvPoint } from "../../services/api/cctvApi";
import { resolveCctvImagePath } from "../../utils/formatters";
import time from "../../utils/time";

export default {
  name: "CctvTable",
  data() {
    return {
      role: "",
      loading: true,
      lastIndex: 5,
      showDataSize: 5,
      showIndex: 0,
      showLastIndex: 5,
      total: 0,
      hideData: [],
      tableData: [],
      search: "",
      pages: [
        { value: "5", label: "5" },
        { value: "10", label: "10" },
        { value: "20", label: "20" },
        { value: "50", label: "50" },
        { value: "100", label: "100" }
      ],
      value: "5"
    };
  },
  computed: {
    filteredRows() {
      const q = this.search.toLowerCase();
      if (!q) {
        return this.tableData;
      }

      return this.tableData.filter(
        (data) =>
          data.name.toLowerCase().includes(q) ||
          data.agency.toLowerCase().includes(q) ||
          data.coordinate.toLowerCase().includes(q) ||
          data.address.toLowerCase().includes(q)
      );
    }
  },
  created() {
    this.loadCctv();
    this.loadAuthUser();
  },
  methods: {
    loadAuthUser() {
      fetchAuthUser()
        .then((data) => {
          if (data && data.user) {
            this.role = data.user.role || "";
          }
        })
        .catch(() => {});
    },
    handleFilter() {
      this.showDataSize = Number.parseInt(this.value, 10);
      this.handleCurrentChange(1);
    },
    handleCurrentChange(val) {
      this.loading = true;
      setTimeout(() => {
        this.showIndex = (val - 1) * this.showDataSize;
        this.showLastIndex = this.showIndex + this.showDataSize;
        this.tableData = [];
        this.applyPagination();
      }, 500);
    },
    applyPagination() {
      this.tableData = this.hideData.slice(this.showIndex, this.showLastIndex);
      this.lastIndex = this.total < this.showLastIndex ? this.total : this.showLastIndex;
      this.loading = false;
    },
    loadCctv() {
      this.hideData = [];
      this.tableData = [];
      fetchCctvPoints()
        .then((rows) => {
          this.total = rows.length;
          this.hideData = rows.map((row) => ({
            id: row.id,
            cctvimg: resolveCctvImagePath(row.path_image),
            name: row.name,
            time: time(new Date(Date.parse(row.updated_at))),
            agency: row.agency,
            coordinate: `${row.longitude} E ${row.lattitude} N`,
            address: row.address,
            status: row.category
          }));
          this.applyPagination();
        })
        .catch(() => {
          this.loading = false;
        });
    },
    deleteRow(index, id) {
      deleteCctvPoint(id)
        .then(() => {
          this.$message({ type: "success", message: "Delete completed" });
          this.loadCctv();
        })
        .catch(() => {
          this.$message({ type: "info", message: "Delete canceled" });
        });
    }
  }
};
</script>

<style>
.taddress {
  color: var(--text-color);
}

.el-tooltip:hover {
  color: var(--text-color);
}

.table-container {
  position: relative;
  padding: 20px;
  background-color: var(--color-secondary);
  border-radius: 10px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}

.controller {
  display: flex;
  margin-bottom: 20px;
}

.el-select-dropdown {
  border: none;
  border-radius: 10px;
  background-color: var(--color-secondary);
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
  margin: 5px 0;
}

.el-input__icon {
  width: 100%;
  margin-right: 60px;
}

.el-popper[x-placement^="bottom"] .popper__arrow,
.el-popper[x-placement^="bottom"] .popper__arrow::after {
  border-bottom-color: var(--color-secondary);
}

.el-select-dropdown__item.selected {
  color: var(--green-theme);
  font-weight: 500;
}

.el-select-dropdown__item {
  color: var(--text-color);
  font-size: var(--size-xs);
}

.el-select-dropdown__item.hover,
.el-select-dropdown__item:hover {
  background-color: var(--color-primary);
}

.el-select:hover .el-input__inner,
.el-select .el-input.is-focus .el-input__inner,
.el-select .el-input__inner:focus {
  border-color: var(--green-theme);
}

.table-search {
  width: 30%;
  display: flex-end;
  position: absolute;
  right: 30px;
}

.count-table {
  left: 10px;
}

.count-table .el-input .el-input__inner,
.table-search .el-input__inner {
  box-shadow: none;
  border: 1px solid var(--green-theme-30);
}

.count-table .el-input .el-input__inner:hover,
.table-search .el-input__inner:hover,
.count-table .el-input .el-input__inner:focus,
.table-search .el-input__inner:focus {
  border-color: var(--green-theme);
}

.el-table {
  font-size: var(--size-sm);
  color: var(--text-color);
  border-radius: 10px;
}

.el-table,
.el-table__expanded-cell {
  background-color: transparent;
}

.el-table--enable-row-hover .el-table__body tr:hover > td {
  background: var(--table-hover);
}

.el-table td,
.el-table:first-child th.is-leaf {
  border-bottom: 1px solid var(--green-theme-30);
}

.el-table td,
.el-table th.is-leaf {
  border-bottom: none;
  background-color: transparent;
}

.el-table th,
.el-table tr {
  background-color: transparent;
}

.el-table thead {
  color: var(--text-color);
  font-weight: 500;
}

.el-table__empty-text {
  color: var(--green-theme);
}

.el-table--border::after,
.el-table--group::after,
.el-table::before {
  background-color: transparent;
}

.table-footer {
  display: flex;
  align-items: center;
  margin: 20px 10px 20px 10px;
}

.pagination-table {
  display: flex-end;
  position: absolute;
  right: 30px;
}

.el-pagination.is-background .btn-next,
.el-pagination.is-background .btn-prev,
.el-pagination.is-background .el-pager li {
  margin: 0 5px;
  background-color: transparent;
  color: var(--text-color);
  border-radius: 100%;
  font-weight: 500;
}

.el-pagination.is-background .el-pager li:not(.disabled).active {
  background-color: var(--green-theme);
  color: #fff;
}

.el-pagination.is-background .el-pager li:not(.disabled).active:hover {
  color: #fff;
}

.el-pagination.is-background .el-pager li:not(.disabled):hover {
  color: var(--green-theme);
}

.el-tag.el-tag--success {
  background-color: var(--tag-bg-success);
  color: var(--tag-text-success);
  border-color: var(--green-theme);
  border-radius: 20px;
}

.el-tag.el-tag--primary {
  background-color: var(--tag-bg-primary);
  color: var(--tag-text-primary);
  border-color: #909399;
  border-radius: 20px;
}

.el-tag.el-tag--success:hover,
.el-tag.el-tag--primary:hover {
  cursor: default;
}

.time-table {
  opacity: 0.5;
  font-style: italic;
  font-size: var(--size-sm);
}

.action-table ion-icon {
  padding: 0 5px;
  opacity: 0.5;
  color: var(--text-color);
  font-size: 1.5em;
  transition: 0.5s;
}

.action-table ion-icon:hover {
  opacity: 1;
  color: var(--green-theme);
  cursor: pointer;
}

.action-table ion-icon.remove:hover {
  opacity: 1;
  color: rgb(190, 22, 22);
  cursor: pointer;
}

.el-table .ascending .sort-caret.ascending {
  opacity: 1;
  border-bottom-color: var(--green-theme);
}

.el-table .descending .sort-caret.descending {
  opacity: 1;
  border-top-color: var(--green-theme);
}

.el-loading-mask {
  background-color: var(--color-secondary);
}

@media screen and (max-width: 600px) {
  .table-footer {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    margin-top: 30px;
  }

  .info-table {
    margin-bottom: 20px;
  }

  .pagination-table {
    position: relative;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>
