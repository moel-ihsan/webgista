import { createLocalVue, shallowMount } from "@vue/test-utils";
import TrafficCounterCards from "@/components/cctv/TrafficCounterCards.vue";
import MapLegend from "@/components/map/MapLegend.vue";
import CctvTable from "@/components/table/CctvTable.vue";
import { fetchAuthUser } from "@/services/api/authApi";
import { fetchAll as fetchCctvPoints } from "@/services/api/cctvApi";
import { TRAFFIC_LEVELS } from "@/services/traffic/ihcmClassifier";

jest.mock("@/services/api/cctvApi", () => ({
  fetchAll: jest.fn(),
  remove: jest.fn()
}));

jest.mock("@/services/api/authApi", () => ({
  fetchAuthUser: jest.fn()
}));

function buildLocalVue() {
  const localVue = createLocalVue();
  localVue.config.ignoredElements = [/^ion-/];
  localVue.directive("loading", {});
  return localVue;
}

describe("Frontend smoke tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders MapLegend with traffic levels", () => {
    const wrapper = shallowMount(MapLegend, {
      localVue: buildLocalVue(),
      propsData: {
        title: "Traffic Condition",
        items: TRAFFIC_LEVELS
      }
    });

    expect(wrapper.find("h4").text()).toBe("Traffic Condition");
    TRAFFIC_LEVELS.forEach((level) => {
      expect(wrapper.text()).toContain(level.label);
    });
  });

  it("renders TrafficCounterCards counts and condition label", () => {
    const wrapper = shallowMount(TrafficCounterCards, {
      localVue: buildLocalVue(),
      stubs: {
        "el-col": { template: "<div><slot /></div>" }
      },
      propsData: {
        lvCount: 5,
        hvCount: 2,
        mcCount: 10,
        conditionLabel: "Very Good"
      }
    });

    expect(wrapper.find("#result-car").text()).toBe("5");
    expect(wrapper.find("#result-truck").text()).toBe("2");
    expect(wrapper.find("#result-motor").text()).toBe("10");
    expect(wrapper.find("#result-kendaraan").text()).toBe("Very Good");
  });

  it("mounts CctvTable and displays fetched CCTV rows and summary", async () => {
    fetchCctvPoints.mockResolvedValue([
      {
        id: 1,
        name: "Simpang PDAM",
        address: "Jl. Teuku Umar",
        lattitude: 5.54,
        longitude: 95.32,
        agency: "Dishub",
        category: "Analytic",
        path_image: null,
        updated_at: "2026-11-21T00:00:00.000000Z"
      },
      {
        id: 2,
        name: "Simpang Jambo Tape",
        address: "Jl. Nyak Makam",
        lattitude: 5.56,
        longitude: 95.33,
        agency: "Dishub",
        category: "Regular",
        path_image: null,
        updated_at: "2026-11-21T00:00:00.000000Z"
      }
    ]);
    fetchAuthUser.mockResolvedValue({ user: { role: "admin" } });

    const wrapper = shallowMount(CctvTable, {
      localVue: buildLocalVue(),
      stubs: {
        "el-select": { template: "<div><slot /></div>" },
        "el-option": true,
        "el-input": true,
        "el-table": { template: "<div><slot /></div>" },
        "el-table-column": true,
        "el-pagination": true,
        "el-button": true,
        "el-avatar": true,
        "el-tooltip": true,
        "el-tag": true
      }
    });

    await Promise.resolve();
    await Promise.resolve();
    await wrapper.vm.$nextTick();

    expect(fetchCctvPoints).toHaveBeenCalledTimes(1);
    expect(fetchAuthUser).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.tableData).toHaveLength(2);
    expect(wrapper.vm.role).toBe("admin");
    expect(wrapper.find(".info-table").text()).toContain("Showing 1 To 2 Of 2 Entries");
  });
});
