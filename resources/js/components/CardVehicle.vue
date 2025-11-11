<template>
  <div>
    <!-- <el-menu
      class="el-menu-report"
      mode="horizontal"
      background-color="transparent"
    >
      <el-menu-item
        class="report-title"
        style="font-size: var(--size-lg) !important"
        disabled
        >Today Report</el-menu-item
      >
      <div class="report" style="font-size: var(--size-lg) !important">
        <el-menu-item class="report-item is-active" index="2" disabled
          >Today</el-menu-item
        >
        <el-menu-item class="report-item" index="3" disabled>All</el-menu-item>
      </div>
    </el-menu> -->
    <el-row :gutter="30">
      <el-col :span="12" :xs="24">
        <div class="veh-info-card">
          <div class="veh-content">
            <div class="veh">Car</div>
            <!-- <div v-for="item in items" :key="item"> -->
            <div class="result-car">{{ totalCar }}</div>
            <!-- </div> -->
          </div>
          <img class="veh-icon" src="/assets/Car.png" />
        </div>
      </el-col>
      <el-col :span="12" :xs="24">
        <div class="veh-info-card motor">
          <div class="veh-content">
            <div class="veh">Motor Bike</div>
            <div class="result-motor">{{ totalMotor }}</div>
          </div>
          <img class="veh-icon" src="/assets/Motor.png" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
export default {
  data() {
    return {
      vehicle: "Car",
      items: [],
    };
  },
  created() {
    this.fetchCctv();
  },
  computed: {
    totalCar() {
      return this.items.reduce((acc, item) => acc + item.car, 0);
    },
    totalMotor() {
      return this.items.reduce((acc, item) => acc + item.motor, 0);
    },
  },
  methods: {
    fetchCctv() {
      axios.get("/api/table").then((res) => {
        res.data.forEach((row, index) => {
          this.items.push({
            id: row.id,
            car: row.car,
            motor: row.motor,
          });
        });
      });
    },
  },
};
</script>


<style>
.el-menu-report {
  margin-top: -50px;
  z-index: 10;
}
.report-title {
  -ms-flex-item-align: start;
  padding: 0;
  color: var(--text-color);
  font-weight: 500;
}
.report {
  display: flex;
  justify-content: flex-end;
  color: var(--text-color);
}
.report .el-menu-item {
  padding: 0;
  margin-left: 30px;
}
.report-item.is-active {
  color: var(--green-theme) !important;
  cursor: pointer;
}
.report-item:hover {
  color: var(--green-theme) !important;
  cursor: pointer;
}
.veh-info-card {
  position: relative;
  cursor: default;
  background-color: var(--color-secondary);
  color: var(--text-color);
  height: 100px;
  border-radius: 10px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 20px;
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
}
.veh-info-card:before {
  content: "";
  position: absolute;
  left: 50%;
  transform: translate(-50%);
  bottom: -0.3em;
  height: 20px;
  width: 80%;
  border-radius: 0px 0px 20px 20px;
  z-index: -2;
  background: var(--green-theme);
  box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -webkit-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  -moz-box-shadow: 0 10px 20px rgba(29, 29, 29, 0.2);
  transition: 0.5s;
}
.veh-info-card:hover:before {
  width: 95%;
}
.veh-info-card img {
  position: absolute;
  right: 0;
  margin-right: -30px;
  height: 250px;
  width: auto;
  transition: 0.5s;
}
.veh-info-card:hover img {
  transform: scale(0.85);
}
.veh-content {
  position: relative;
  left: 0;
  padding: 40px;
}
.veh {
  font-size: var(--size-lg);
}
.veh-info-card:hover .total {
  color: var(--green-theme);
}
.total {
  font-size: var(--size-xl);
  font-weight: 500;
  color: var(--text-color);
  transition: 0.5s;
}
.graphic-card {
  margin-top: 30px;
  height: auto;
}
.btn-group-graph {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 3;
}
.el-button--primary {
  color: #fff;
  background-color: var(--green-theme);
  border-radius: 10px;
  border-color: var(--green-theme);
  transition: all 0.15s ease;
}
.el-button--primary:focus,
.el-button--primary:hover {
  background-color: var(--green-theme);
  border-color: var(--green-theme);
  border-right-color: var(--green-theme);
  color: #fff;
  box-shadow: 2px 2px 6px rgba(29, 29, 29, 0.2);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}
.el-button--info {
  color: var(--green-theme);
  border-radius: 10px;
  background-color: transparent;
  border-color: var(--green-theme);
  transition: all 0.15s ease;
}
.el-button--info:focus,
.el-button--info:hover {
  background: transparent;
  border-color: var(--green-hover);
  border-left-color: var(--green-hover);
  color: var(--green-theme);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}

.el-button--danger {
  color: var(--tag-text-primary);
  border-radius: 10px;
  background-color: var(--tag-bg-primary);
  border-color: #909399;
  transition: all 0.15s ease;
}
.el-button--danger:focus,
.el-button--danger:hover {
  background: var(--tag-bg-primary);
  border-color: #909399;
  border-left-color: #909399;
  color: var(--tag-text-primary);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}

.el-button--warning {
  color: var(--tag-text-success);
  border-radius: 10px;
  background-color: var(--tag-bg-success);
  border-color: var(--green-theme);
  transition: all 0.15s ease;
}
.el-button--warning:focus,
.el-button--warning:hover {
  background: var(--tag-bg-success);
  border-color: var(--green-theme);
  border-left-color: var(--green-theme);
  color: var(--tag-text-success);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}
.el-button--primary:active,
.el-button--info:active,
.el-button--danger:active,
.el-button--warning:active {
  transform: translateY(1px) !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}
.el-radio-button__orig-radio:checked + .el-radio-button__inner {
  color: #fff;
  background-color: var(--green-theme);
  border-color: var(--green-theme);
  box-shadow: none !important;
  transition: all 0.15s ease;
}
.el-radio-button__orig-radio:checked:hover + .el-radio-button__inner,
.el-radio-button__orig-radio:checked:focus + .el-radio-button__inner {
  background-color: var(--green-theme);
  border-color: var(--green-theme);
  border-right-color: var(--green-theme);
  color: #fff;
  box-shadow: 2px 2px 6px rgba(29, 29, 29, 0.2);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}
.el-radio-button__orig-radio:checked:active + .el-radio-button__inner,
.el-radio-button--medium .el-radio-button__inner:active {
  transform: translateY(1px) !important;
  box-shadow: none !important;
  transition: all 0.15s ease;
}
.el-radio-button--medium .el-radio-button__inner {
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 0;
  color: var(--green-theme);
  background-color: transparent;
  border-color: var(--green-theme);
  transition: all 0.15s ease;
}
.el-radio-button--medium .el-radio-button__inner:hover,
.el-radio-button--medium .el-radio-button__inner:focus {
  background: transparent;
  border-color: var(--green-hover);
  border-left-color: var(--green-hover);
  color: var(--green-theme);
  box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
  -webkit-transform: translateY(-1px);
}
.el-radio-button:first-child .el-radio-button__inner {
  border-left: 1px solid var(--green-theme);
  border-left-color: var(--green-theme);
  border-radius: 10px 0 0 10px;
  box-shadow: none !important;
}
.el-radio-button:last-child .el-radio-button__inner {
  border-left: none;
  border-left-color: var(--green-theme);
  border-radius: 0px 10px 10px 0px;
  box-shadow: none !important;
}
@media screen and (max-width: 992px) {
  .veh-info-card img {
    position: absolute;
    right: 0;
    margin-right: 0px;
    height: 160px;
    width: auto;
    transition: 0.5s;
  }
  .veh-info-card:hover img {
    transform: scale(0.85);
  }
  .veh-content {
    position: relative;
    left: 0;
    padding: 20px;
  }
  .veh {
    font-size: var(--size-lg);
  }
  .veh-info-card:hover .total {
    color: var(--green-theme);
  }
  .total {
    font-size: var(--size-xl);
    color: var(--text-color);
    transition: 0.5s;
  }
}
@media screen and (max-width: 600px) {
  .veh-info-card img {
    margin-right: 0px;
  }

  .veh-info-card.motor {
    margin-top: 30px;
  }
}
</style>

