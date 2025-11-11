<template>
    <div class="table-container">
        <div class="controller">
            <el-select
                v-model="value"
                size="mini"
                class="count-table"
                @change="handleFilter"
            >
                <el-option
                    v-for="item in pages"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                    size="mini"
                >
                </el-option>
            </el-select>
            <el-input
                class="table-search"
                v-model="search"
                size="mini"
                placeholder="Type to search"
            />
        </div>
        <el-table
            empty-text="No Data"
            v-loading="loading"
            element-loading-spinner="oke"
            :data="
                tableData.filter(
                    data =>
                        !search ||
                        data.name
                            .toLowerCase()
                            .includes(search.toLowerCase()) ||
                        data.agency
                            .toLowerCase()
                            .includes(search.toLowerCase()) ||
                        data.coordinate
                            .toLowerCase()
                            .includes(search.toLowerCase()) ||
                        data.address
                            .toLowerCase()
                            .includes(search.toLowerCase())
                )
            "
            style="width: 100%"
        >
            <el-table-column label="Name" prop="name" min-width="100" sortable>
                <template slot-scope="scope">
                    <div style="display: flex; flex-direction: row">
                        <el-avatar
                            style="margin-right: 10px"
                            :size="large"
                            :src="scope.row.cctvimg"
                        ></el-avatar>
                        <div class="cctv-name">
                            <div prop="name">
                                {{ scope.row.name }}
                            </div>
                            <div class="time-table" prop="time">
                                {{ scope.row.time }}
                            </div>
                        </div>
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="Address" prop="address" sortable>
                <template slot-scope="scope">
                    <div v-if="scope.row.address.length > 20">
                        <el-tooltip placement="top">
                            <div slot="content">{{ scope.row.address }}</div>
                            <div
                                class="hdd taddress"
                                style="margin-left: -11px"
                            >
                                {{ scope.row.address.substr(0, 20) }} . . .
                            </div>
                        </el-tooltip>
                    </div>
                    <div v-else>
                        {{ scope.row.address }}
                    </div>
                </template>
            </el-table-column>
            <el-table-column label="Coordinate" prop="coordinate" sortable>
            </el-table-column>
            <el-table-column label="Agency" prop="agency" sortable>
            </el-table-column>
            <el-table-column label="Status" prop="status" sortable width="100">
                <template slot-scope="scope">
                    <el-tag
                        :type="
                            scope.row.status === 'Regular'
                                ? 'primary'
                                : 'success'
                        "
                        disable-transitions
                        >{{ scope.row.status }}</el-tag
                    >
                </template></el-table-column
            >
            <el-table-column align="center">
                <template slot="header" slot-scope="scope">
                    <a href="/table/add" v-if="role == 'admin'">
                        <el-button
                            type="info"
                            class="detail"
                            icon="el-icon-plus"
                            round
                            >Add New</el-button
                        ></a
                    >
                </template>
                <template slot-scope="scope">
                    <div class="action-table">
                        <a :href="'/detail/' + scope.row.id">
                            <ion-icon name="eye"></ion-icon>
                        </a>
                        <a
                            :href="'/table/edit/' + scope.row.id"
                            v-if="role == 'admin'"
                        >
                            <ion-icon name="pencil"></ion-icon>
                        </a>
                        <el-button
                            v-if="role == 'admin'"
                            @click.native.prevent="
                                deleteRow(scope.$index, tableData, scope.row.id)
                            "
                            type="text"
                            size="small"
                        >
                            <ion-icon
                                class="remove"
                                name="close"
                                type="text"
                            ></ion-icon>
                        </el-button>
                    </div>
                </template>
            </el-table-column>
        </el-table>
        <div class="table-footer">
            <div
                class="info-table"
                style="font-size: var(--size-sm); color: var(--green-theme)"
            >
                Showing {{ showIndex + 1 }} To {{ lastIndex }} Of
                {{ total }} Entries
            </div>
            <el-pagination
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
                class="pagination-table"
                background
                layout="prev, pager, next"
                :total="total"
                :page-size="showDataSize"
            >
            </el-pagination>
        </div>
    </div>
</template>

<script>
import time from "../utils/time";

export default {
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
                {
                    value: "5",
                    label: "5"
                },
                {
                    value: "10",
                    label: "10"
                },
                {
                    value: "20",
                    label: "20"
                },
                {
                    value: "50",
                    label: "50"
                },
                {
                    value: "100",
                    label: "100"
                }
            ],
            value: "5"
        };
    },
    created() {
        this.fetchCctv();
        this.fetchUser();
    },
    methods: {
        financial(x) {
            return Number.parseFloat(x).toFixed(6);
        },
        fetchUser() {
            axios
                .get("/authUser")
                .then(res => {
                    this.role = res.data.user.role;
                })
                .catch(err => console.log(err));
        },
        handleCollapse(newCollapse, newDisplay) {
            this.isCollapse = newCollapse;
        },
        handleFilter() {
            this.prevDataSize = this.showDataSize;
            this.showDataSize = parseInt(this.value);
            console.log(this.showDataSize);
            this.handleCurrentChange(1);
        },
        handleSizeChange(val) {
            console.log(`${val} items per page`);
        },
        handleCurrentChange(val) {
            this.loading = true;
            setTimeout(() => {
                this.showIndex = (val - 1) * this.showDataSize;
                this.showLastIndex = this.showIndex + this.showDataSize;
                this.tableData = [];
                this.handleChangePagination();
                console.log(
                    `current page: ${val} => tampil data ${this.showIndex} sampai ${this.showLastIndex}`
                );
            }, 500);
        },
        handleChangePagination() {
            this.hideData.forEach((row, index) => {
                // console.log(row);
                if (index >= this.showIndex && index < this.showLastIndex)
                    this.tableData.push({
                        id: row.id,
                        cctvimg: row.cctvimg,
                        name: row.name,
                        time: row.time,
                        agency: row.agency,
                        coordinate: row.coordinate,
                        address: row.address,
                        status: row.status
                    });
            });

            if (this.total < this.showLastIndex) this.lastIndex = this.total;
            else this.lastIndex = this.showLastIndex;
            this.loading = false;
        },
        objectSpanMethod({ row, column, rowIndex, columnIndex }) {
            console.log(row);
            if (columnIndex === 0) {
                if (rowIndex === 0) {
                    return {
                        rowspan: 1,
                        colspan: 2
                    };
                }
            }
        },
        fetchCctv() {
            this.hideData = [];
            this.tableData = [];
            axios.get("/api/table").then(res => {
                // console.log(res.data);
                this.total = res.data.length;
                res.data.forEach((row, index) => {
                    let path =
                        row.path_image.split("/").length == 3
                            ? "/storage/" + row.path_image
                            : "./assets/" + row.path_image;
                    this.hideData.push({
                        id: row.id,
                        cctvimg: path,
                        name: row.name,
                        time: time(new Date(Date.parse(row.updated_at))),
                        agency: row.agency,
                        coordinate: `${row.longitude} E ${row.lattitude} N`,
                        address: row.address,
                        status: row.category
                    });
                });
                this.handleChangePagination();
            });
        },
        deleteRow(index, rows, id) {
            axios
                .get(`/destroy/${id}`)
                .then(() => {
                    this.$message({
                        type: "success",
                        message: "Delete completed"
                    });
                })
                .catch(() => {
                    this.$message({
                        type: "info",
                        message: "Delete canceled"
                    });
                });
            rows.splice(index, 1);
            this.fetchCctv();
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
    margin-top: 5px;
}
.el-input__icon {
    width: 100%;
    margin-right: 60px;
}
.el-popper[x-placement^="bottom"] .popper__arrow {
    border-bottom-color: var(--color-secondary);
}
.el-popper[x-placement^="bottom"] .popper__arrow::after {
    border-bottom-color: var(--color-secondary);
}
.el-select-dropdown__item.selected {
    color: var(--green-theme);
    font-weight: 500;
}
.el-select-dropdown__item {
    color: var(--text-color);
}
.el-select-dropdown__item.hover,
.el-select-dropdown__item:hover {
    background-color: var(--color-primary);
}
.el-select:hover .el-input__inner {
    border-color: var(--green-theme);
}
.el-select .el-input.is-focus .el-input__inner {
    border-color: var(--green-theme);
}
.el-select .el-input__inner:focus {
    border-color: var(--green-theme);
}
.el-select-dropdown__item {
    font-size: var(--size-xs);
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
    /* color: #909399; */
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
@media screen and (max-width: 992px) {
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
