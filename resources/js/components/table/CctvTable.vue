<template>
  <div class="table-container">
    <div class="table-toolbar">
      <div class="table-toolbar-left">
        <label for="table-page-size" class="sr-only">Rows per page</label>
        <el-select
          id="table-page-size"
          v-model="value"
          class="count-table"
          aria-label="Rows per page"
          @change="handleFilter"
        >
          <el-option
            v-for="item in pages"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>

        <div class="table-search-wrap">
          <label for="table-search-input" class="sr-only">Search CCTV cameras</label>
          <el-input
            id="table-search-input"
            v-model="search"
            class="table-search"
            placeholder="Type to search"
            aria-label="Search CCTV cameras"
          />
        </div>
      </div>

      <a v-if="role === 'admin'" href="/table/add" class="table-add-btn">
        <AppIcon name="plus" :size="18" />
        <span>Add New</span>
      </a>
    </div>

    <!-- Desktop / Tablet table -->
    <div class="table-desktop-wrap">
      <el-table
        v-loading="loading"
        empty-text="No Data"
        element-loading-spinner="oke"
        :data="filteredRows"
        style="width: 100%"
      >
        <el-table-column label="Name" prop="name" min-width="160" sortable>
          <template slot-scope="scope">
            <div class="table-name-cell">
              <img
                :src="scope.row.cctvimg"
                :alt="`Preview of ${scope.row.name}`"
                class="table-thumb-img"
              />
              <div class="cctv-name">
                <div class="cctv-title-text" prop="name">{{ scope.row.name }}</div>
                <div class="time-table" prop="time">{{ scope.row.time }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Address" prop="address" min-width="145" sortable>
          <template slot-scope="scope">
            <div v-if="scope.row.address.length > 22">
              <el-tooltip placement="top">
                <div slot="content">{{ scope.row.address }}</div>
                <span class="taddress">{{ scope.row.address.substr(0, 22) }}…</span>
              </el-tooltip>
            </div>
            <div v-else class="taddress">{{ scope.row.address }}</div>
          </template>
        </el-table-column>

        <el-table-column label="Coordinate" prop="coordinate" min-width="150" sortable />
        <el-table-column label="Agency" prop="agency" min-width="100" sortable />

        <el-table-column label="Status" prop="status" sortable min-width="105">
          <template slot-scope="scope">
            <span
              class="table-status-pill"
              :class="
                scope.row.status === 'Regular'
                  ? 'table-status-pill--regular'
                  : 'table-status-pill--analytic'
              "
            >
              {{ scope.row.status }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="Actions" align="center" min-width="155">
          <template slot-scope="scope">
            <div class="action-table">
              <a
                :href="'/detail/' + scope.row.id"
                class="action-icon-btn"
                :aria-label="`View details for ${scope.row.name}`"
                title="Detail"
              >
                <AppIcon name="eye" :size="18" />
              </a>
              <a
                v-if="role === 'admin'"
                :href="'/table/edit/' + scope.row.id"
                class="action-icon-btn"
                :aria-label="`Edit ${scope.row.name}`"
                title="Edit"
              >
                <AppIcon name="pencil" :size="18" />
              </a>
              <button
                v-if="role === 'admin'"
                type="button"
                class="action-icon-btn action-icon-btn--danger"
                :aria-label="`Delete ${scope.row.name}`"
                title="Delete"
                @click="deleteRow(scope.$index, scope.row.id)"
              >
                <AppIcon name="close" :size="18" />
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Mobile Responsive Card List (< 768px) -->
    <div class="table-mobile-list">
      <div v-if="loading" class="ui-state-box">Loading CCTV data…</div>
      <div v-else-if="filteredRows.length === 0" class="ui-state-box">No Data</div>
      <article v-for="row in filteredRows" v-else :key="'m-' + row.id" class="mobile-cctv-card">
        <div class="mobile-card-head">
          <img :src="row.cctvimg" :alt="`Preview of ${row.name}`" class="table-thumb-img" />
          <div class="mobile-card-title-wrap">
            <h2 class="mobile-card-title">{{ row.name }}</h2>
            <div class="time-table">{{ row.time }}</div>
          </div>
          <span
            class="table-status-pill"
            :class="
              row.status === 'Regular'
                ? 'table-status-pill--regular'
                : 'table-status-pill--analytic'
            "
          >
            {{ row.status }}
          </span>
        </div>

        <dl class="mobile-card-meta">
          <div class="mobile-meta-row">
            <dt>Address</dt>
            <dd>{{ row.address }}</dd>
          </div>
          <div class="mobile-meta-row">
            <dt>Coordinate</dt>
            <dd>{{ row.coordinate }}</dd>
          </div>
          <div class="mobile-meta-row">
            <dt>Agency</dt>
            <dd>{{ row.agency }}</dd>
          </div>
        </dl>

        <div class="mobile-card-actions">
          <a
            :href="'/detail/' + row.id"
            class="action-icon-btn mobile-action-chip"
            :aria-label="`Detail ${row.name}`"
          >
            <AppIcon name="eye" :size="18" />
            <span>Detail</span>
          </a>
          <a
            v-if="role === 'admin'"
            :href="'/table/edit/' + row.id"
            class="action-icon-btn mobile-action-chip"
            :aria-label="`Edit ${row.name}`"
          >
            <AppIcon name="pencil" :size="18" />
            <span>Edit</span>
          </a>
          <button
            v-if="role === 'admin'"
            type="button"
            class="action-icon-btn action-icon-btn--danger mobile-action-chip"
            :aria-label="`Delete ${row.name}`"
            @click="deleteRow(0, row.id)"
          >
            <AppIcon name="close" :size="18" />
            <span>Delete</span>
          </button>
        </div>
      </article>
    </div>

    <div class="table-footer">
      <div class="info-table">
        Showing {{ total === 0 ? 0 : showIndex + 1 }} To {{ lastIndex }} Of {{ total }} Entries
      </div>
      <div ref="paginationWrap">
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
  mounted() {
    this.enhanceAccessibleTableControls();
  },
  updated() {
    this.enhanceAccessibleTableControls();
  },
  methods: {
    enhanceAccessibleTableControls() {
      const wrap = this.$refs.paginationWrap;
      if (wrap && typeof wrap.querySelector === "function") {
        const prevBtn = wrap.querySelector(".btn-prev");
        const nextBtn = wrap.querySelector(".btn-next");
        if (prevBtn) {
          prevBtn.setAttribute("aria-label", "Previous page");
        }
        if (nextBtn) {
          nextBtn.setAttribute("aria-label", "Next page");
        }
      }
    },
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
    deleteRow(_index, id) {
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
.table-container {
  position: relative;
  padding: var(--space-5);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  color: var(--text-primary);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.table-toolbar-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.count-table {
  width: 96px !important;
}

.table-search-wrap {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
}

.table-add-btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  background-color: var(--accent-primary);
  color: var(--accent-on-fill);
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.table-add-btn:hover {
  background-color: var(--accent-primary-hover);
  color: var(--accent-on-fill);
}

.table-desktop-wrap {
  width: 100%;
  overflow-x: auto;
}

.table-mobile-list {
  display: none;
}

.table-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-thumb-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
}

.cctv-title-text {
  font-weight: 600;
  color: var(--text-primary);
}

.time-table {
  color: var(--text-muted);
  font-size: var(--text-caption);
  margin-top: 2px;
}

.taddress {
  color: var(--text-secondary);
}

.table-status-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: 700;
}

.table-status-pill--analytic {
  background-color: var(--accent-soft-bg);
  color: var(--accent-soft-text);
  border: 1px solid var(--accent-soft-border);
}

.table-status-pill--regular {
  background-color: var(--tag-bg-primary);
  color: var(--tag-text-primary);
  border: 1px solid var(--border-subtle);
}

.action-table {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.action-icon-btn {
  min-width: 44px;
  min-height: 44px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  background-color: var(--bg-surface-subtle);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}

.action-icon-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-icon-btn--danger:hover {
  border-color: var(--danger-fill);
  color: var(--danger-text);
  background-color: var(--danger-soft-bg);
}

.el-table {
  font-size: var(--text-sm);
  color: var(--text-primary);
  background-color: transparent;
}

.el-table--enable-row-hover .el-table__body tr:hover > td {
  background: var(--table-hover);
}

.el-table td,
.el-table th.is-leaf {
  border-bottom: 1px solid var(--border-subtle);
  background-color: transparent;
}

.el-table th,
.el-table tr {
  background-color: transparent;
}

.el-table thead {
  color: var(--text-secondary);
  font-weight: 700;
}

.el-table::before {
  background-color: transparent;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.info-table {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--accent-primary);
}

.el-pagination.is-background .btn-next,
.el-pagination.is-background .btn-prev,
.el-pagination.is-background .el-pager li {
  min-width: 44px;
  height: 44px;
  line-height: 44px;
  margin: 0 3px;
  background-color: var(--bg-surface-subtle);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  border-radius: 50%;
  font-weight: 600;
}

.el-pagination.is-background .el-pager li:not(.disabled).active {
  background-color: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--accent-on-fill);
}

.el-pagination.is-background .el-pager li:not(.disabled).active:hover {
  color: var(--accent-on-fill);
}

@media screen and (max-width: 1023px) {
  .table-container {
    padding: var(--space-4);
  }

  .table-desktop-wrap {
    display: none;
  }

  .table-mobile-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .table-search-wrap {
    max-width: none;
    width: 100%;
  }

  .mobile-cctv-card {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    background-color: var(--bg-surface-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .mobile-card-head {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .mobile-card-title-wrap {
    flex: 1;
    min-width: 0;
  }

  .mobile-card-title {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 700;
    color: var(--text-primary);
  }

  .mobile-card-meta {
    margin: 0;
    display: grid;
    gap: 6px;
  }

  .mobile-meta-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mobile-meta-row dt {
    font-size: var(--text-caption);
    font-weight: 700;
    color: var(--text-muted);
  }

  .mobile-meta-row dd {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    word-break: break-word;
  }

  .mobile-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mobile-action-chip {
    flex: 1;
    padding: 0 12px;
    font-size: var(--text-sm);
    font-weight: 600;
  }

  .table-footer {
    justify-content: center;
    flex-direction: column;
  }
}
</style>
