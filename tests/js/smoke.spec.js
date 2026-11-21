import { createLocalVue, shallowMount } from "@vue/test-utils";
import mapboxgl from "mapbox-gl";
import CctvDetailView from "@/components/cctv/CctvDetailView.vue";
import TrafficCounterCards from "@/components/cctv/TrafficCounterCards.vue";
import VideoDetectorPlayer from "@/components/cctv/VideoDetectorPlayer.vue";
import SimulationBanner from "@/components/layout/SimulationBanner.vue";
import MapLegend from "@/components/map/MapLegend.vue";
import TrafficMap from "@/components/map/TrafficMap.vue";
import CctvTable from "@/components/table/CctvTable.vue";
import { fetchAuthUser } from "@/services/api/authApi";
import {
  fetchAll as fetchCctvPoints,
  updateRoi,
  updateTrafficCondition
} from "@/services/api/cctvApi";
import { fetchAll as fetchMapSettings } from "@/services/api/mapSettingApi";
import { TRAFFIC_LEVELS } from "@/services/traffic/ihcmClassifier";

jest.mock("@/services/api/cctvApi", () => ({
  fetchAll: jest.fn(),
  remove: jest.fn(),
  updateRoi: jest.fn(() => Promise.resolve({})),
  updateTrafficCondition: jest.fn(() => Promise.resolve({}))
}));

jest.mock("@/services/api/authApi", () => ({
  fetchAuthUser: jest.fn()
}));

jest.mock("@/services/api/mapSettingApi", () => ({
  fetchAll: jest.fn()
}));

jest.mock("mapbox-gl", () => {
  const handlers = {};
  const sourceData = {};
  const layers = {};

  const mockMapInstance = {
    __handlers: handlers,
    __sources: sourceData,
    __layers: layers,
    addControl: jest.fn(),
    on: jest.fn((event, layerOrFn, maybeFn) => {
      const key = typeof layerOrFn === "string" ? `${event}:${layerOrFn}` : event;
      const fn = typeof layerOrFn === "string" ? maybeFn : layerOrFn;
      if (!handlers[key]) handlers[key] = [];
      handlers[key].push(fn);
    }),
    addSource: jest.fn((id, cfg) => {
      sourceData[id] = {
        data: cfg.data,
        setData: jest.fn((next) => {
          sourceData[id].data = next;
        }),
        getClusterExpansionZoom: jest.fn((_, cb) => cb(null, 15))
      };
    }),
    getSource: jest.fn((id) => sourceData[id] || null),
    addLayer: jest.fn((layer) => {
      layers[layer.id] = {
        ...layer,
        visibility: (layer.layout && layer.layout.visibility) || "visible"
      };
    }),
    getLayer: jest.fn((id) => layers[id] || null),
    getLayoutProperty: jest.fn((id, prop) => (layers[id] ? layers[id][prop] : undefined)),
    setLayoutProperty: jest.fn((id, prop, val) => {
      if (layers[id]) layers[id][prop] = val;
    }),
    setStyle: jest.fn(),
    setFeatureState: jest.fn(),
    flyTo: jest.fn(),
    easeTo: jest.fn(),
    getCanvas: jest.fn(() => ({ style: {} })),
    queryRenderedFeatures: jest.fn(() => []),
    remove: jest.fn()
  };

  const PopupMock = jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis()
  }));

  return {
    __esModule: true,
    default: {
      accessToken: "",
      Map: jest.fn(() => mockMapInstance),
      NavigationControl: jest.fn(),
      GeolocateControl: jest.fn(),
      Popup: PopupMock,
      __reset: () => {
        Object.keys(handlers).forEach((k) => delete handlers[k]);
        Object.keys(sourceData).forEach((k) => delete sourceData[k]);
        Object.keys(layers).forEach((k) => delete layers[k]);
        jest.clearAllMocks();
      },
      __getInstance: () => mockMapInstance
    }
  };
});

function buildLocalVue() {
  const localVue = createLocalVue();
  localVue.config.ignoredElements = [/^ion-/];
  localVue.directive("loading", {});
  return localVue;
}

describe("Frontend smoke tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mapboxgl.__reset();
    document.head.innerHTML = "";
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it("renders SimulationBanner only when simulation is enabled", () => {
    const disabledWrapper = shallowMount(SimulationBanner, { localVue: buildLocalVue() });
    expect(disabledWrapper.find(".simulation-demo-banner").exists()).toBe(false);

    const meta = document.createElement("meta");
    meta.name = "webgista-simulation";
    meta.content = JSON.stringify({
      enabled: true,
      banner_text: "SIMULASI DEMO — Video contoh."
    });
    document.head.appendChild(meta);

    const enabledWrapper = shallowMount(SimulationBanner, { localVue: buildLocalVue() });
    expect(enabledWrapper.find(".simulation-demo-banner").exists()).toBe(true);
    expect(enabledWrapper.text()).toContain("SIMULASI DEMO — Video contoh.");
  });

  it("renders CctvDetailView with Detection View action only for Analytic cameras", () => {
    const stubs = {
      "el-row": { template: "<div><slot /></div>" },
      "el-col": { template: "<div><slot /></div>" },
      "el-card": { template: "<div><slot /></div>" },
      "el-tag": { template: "<span><slot /></span>" },
      "el-button": { template: "<button><slot /></button>" },
      CoordinatePickerMap: true
    };

    const analyticWrapper = shallowMount(CctvDetailView, {
      localVue: buildLocalVue(),
      stubs,
      propsData: {
        cctv: {
          id: 1,
          name: "Simpang PDAM",
          category: "Analytic",
          address: "Jl. Teuku Nyak Arief",
          lattitude: "5.56",
          longitude: "95.34",
          agency: "Dishub",
          url: "/demo/videos/simpang-pdam.mp4"
        }
      }
    });

    expect(analyticWrapper.find("video").exists()).toBe(true);
    expect(analyticWrapper.find('a[href="/detail/video/1"]').exists()).toBe(true);

    const regularWrapper = shallowMount(CctvDetailView, {
      localVue: buildLocalVue(),
      stubs,
      propsData: {
        cctv: {
          id: 2,
          name: "Camera Regular",
          category: "Regular",
          address: "Jl. Merdeka",
          lattitude: "5.55",
          longitude: "95.32",
          agency: "Dishub",
          url: null
        }
      }
    });

    expect(regularWrapper.find("video").exists()).toBe(false);
    expect(regularWrapper.find("a.detail-detect-link").exists()).toBe(false);
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

  it("supports all v1 TrafficMap controls, boundary overlay, search, flyTo, and 1000ms polling", async () => {
    jest.useFakeTimers();

    fetchMapSettings.mockResolvedValue([
      { id: 1, lattitude: 5.552874, longitude: 95.327801, zoom: 13 }
    ]);
    fetchCctvPoints
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "Simpang PDAM",
          address: "Jl. Teuku Nyak Arief",
          lattitude: 5.5612,
          longitude: 95.3448,
          category: "Analytic",
          keterangan: "Great",
          path_image: "tf1.jpg",
          url: "/demo/videos/simpang-pdam.mp4"
        },
        {
          id: 2,
          name: "Simpang Jambo Tape",
          address: "Jl. T. Daud Beureueh",
          lattitude: 5.5587,
          longitude: 95.3315,
          category: "Analytic",
          keterangan: "Average",
          path_image: "tf2.jpg",
          url: "/demo/videos/simpang-jambo-tape.mp4"
        }
      ])
      .mockResolvedValue([
        {
          id: 1,
          name: "Simpang PDAM",
          address: "Jl. Teuku Nyak Arief",
          lattitude: 5.5612,
          longitude: 95.3448,
          category: "Analytic",
          keterangan: "Terrible",
          path_image: "tf1.jpg",
          url: "/demo/videos/simpang-pdam.mp4"
        },
        {
          id: 2,
          name: "Simpang Jambo Tape",
          address: "Jl. T. Daud Beureueh",
          lattitude: 5.5587,
          longitude: 95.3315,
          category: "Analytic",
          keterangan: "Good",
          path_image: "tf2.jpg",
          url: "/demo/videos/simpang-jambo-tape.mp4"
        }
      ]);

    const overlayEl = document.createElement("div");
    overlayEl.id = "map-overlay";
    document.body.appendChild(overlayEl);

    const wrapper = shallowMount(TrafficMap, {
      localVue: buildLocalVue(),
      stubs: {
        "ion-icon": true
      },
      attachTo: overlayEl
    });

    await Promise.resolve();
    await Promise.resolve();

    // Sidebar items load immediately in created() even before map style.load completes
    expect(wrapper.vm.items).toHaveLength(2);
    expect(wrapper.vm.filteredItems).toHaveLength(2);

    const map = mapboxgl.__getInstance();
    expect(mapboxgl.Map).toHaveBeenCalledTimes(1);
    expect(map.__handlers["mousemove:state-fills"]).toHaveLength(1);

    // Simulate initial style.load and a second style.load after basemap switch
    map.__handlers["style.load"].forEach((fn) => fn());
    await Promise.resolve();
    await Promise.resolve();
    map.__handlers["style.load"].forEach((fn) => fn());
    await Promise.resolve();
    expect(map.__handlers["mousemove:state-fills"]).toHaveLength(1);

    expect(map.__sources.data).toBeTruthy();
    expect(map.__sources.bandaaceh).toBeTruthy();
    expect(map.__layers["state-fills"]).toBeTruthy();

    // Test boundary hover overlay
    map.__handlers["mousemove:state-fills"][0]({
      features: [{ id: 3, properties: { KECAMATAN: "Kecamatan Syiah Kuala", Luas: 1321.21 } }]
    });
    expect(wrapper.find("#map-overlay").text()).toContain("Kecamatan Syiah Kuala");
    expect(wrapper.find("#map-overlay").text()).toContain("1321.21 ha");

    // Test layer toggle, style switch, search filter, flyTo, zoomHome, sidebar toggle
    wrapper.vm.toggleLayer(1);
    expect(wrapper.vm.cities[0].vis).toBe("visible");
    wrapper.vm.handleStyleChange({ id: "dark-v10", label: "Dark" });
    expect(map.setStyle).toHaveBeenCalledWith("mapbox://styles/mapbox/dark-v10");

    wrapper.vm.filterState = "PDAM";
    expect(wrapper.vm.filteredItems).toHaveLength(1);
    wrapper.vm.flyToCctv(1);
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [95.3448, 5.5612], zoom: 16 })
    );

    wrapper.vm.toggleSidebar();
    expect(wrapper.vm.rightCollapsed).toBe(false);
    expect(map.easeTo).toHaveBeenCalledWith({ padding: { right: 400 }, duration: 1000 });

    wrapper.vm.zoomHome();
    await Promise.resolve();
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [95.327801, 5.552874], zoom: 13 })
    );

    // Test 1000ms polling updates condition to "Terrible"
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();
    expect(map.__sources.data.data.features[0].properties.cond).toBe("Terrible");

    wrapper.destroy();
    overlayEl.remove();
  });

  it("allows editing the 5-point blue ROI on #canvasx via Manage Video and Done", async () => {
    fetchAuthUser.mockResolvedValue({ user: { role: "admin" } });
    updateRoi.mockResolvedValue({});
    updateTrafficCondition.mockResolvedValue({});

    const fakeCtx = {
      clearRect: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      setLineDash: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      clip: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      rect: jest.fn(),
      drawImage: jest.fn()
    };

    const getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeCtx);
    const messageMock = jest.fn();

    const wrapper = shallowMount(VideoDetectorPlayer, {
      localVue: buildLocalVue(),
      mocks: {
        $message: messageMock
      },
      stubs: {
        "el-row": { template: "<div><slot /></div>" },
        "el-col": { template: "<div><slot /></div>" },
        "el-card": { template: "<div><slot /></div>" },
        "el-form": { template: "<div><slot /></div>" },
        TrafficCounterCards: true
      },
      propsData: {
        cctv: {
          id: 1,
          name: "Simpang PDAM",
          category: "Analytic",
          url: "/demo/videos/simpang-pdam.mp4"
        }
      }
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(wrapper.vm.isAdmin).toBe(true);

    const canvasx = wrapper.find("#canvasx");
    canvasx.element.width = 640;
    canvasx.element.height = 360;
    canvasx.element.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 360
    });

    await wrapper.find("#btn-manage").trigger("click");
    expect(wrapper.find("#roi-edit-hint").text()).toContain("0/5 titik");

    const pts = [
      [100, 100],
      [400, 100],
      [500, 300],
      [300, 340],
      [80, 300]
    ];
    for (const [clientX, clientY] of pts) {
      await canvasx.trigger("mousedown", { clientX, clientY });
    }

    expect(wrapper.vm.draftRoiPoints).toHaveLength(5);
    expect(wrapper.find("#roi-edit-hint").text()).toContain("5/5 titik");

    await wrapper.find("#btn-drop").trigger("click");
    await Promise.resolve();

    expect(wrapper.vm.areaVideo).toBe(true);
    expect(wrapper.vm.roiPoints).toHaveLength(5);
    expect(updateRoi).toHaveBeenCalledTimes(1);
    expect(messageMock).toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));

    wrapper.destroy();
    getContextSpy.mockRestore();
  });
});
