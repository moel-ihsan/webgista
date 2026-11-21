import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_STYLES,
  buildOutdoorRasterStyle,
  getMapConfig,
  getMapStyle,
  normalizeStyleId,
  resolveMapProvider
} from "../../resources/js/config/map";

describe("map config and style resolution", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  test("exports default center, zoom, and all 4 v1 style presets", () => {
    expect(DEFAULT_MAP_CENTER).toHaveLength(2);
    expect(DEFAULT_MAP_ZOOM).toBe(13);
    expect(MAP_STYLES.map((s) => s.label)).toEqual(["Street", "Light", "Dark", "Outdoor"]);
  });

  test("normalizes legacy Mapbox v1 style slugs", () => {
    expect(normalizeStyleId("streets-v11")).toBe("streets");
    expect(normalizeStyleId("light-v10")).toBe("light");
    expect(normalizeStyleId("dark-v10")).toBe("dark");
    expect(normalizeStyleId("outdoors-v11")).toBe("outdoor");
  });

  test("defaults to keyless OpenFreeMap + OpenTopoMap Outdoor when no API keys are present", () => {
    const config = getMapConfig();
    expect(resolveMapProvider(config)).toBe("openfreemap");

    expect(getMapStyle("streets", config)).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(getMapStyle("light", config)).toBe("https://tiles.openfreemap.org/styles/positron");
    expect(getMapStyle("dark", config)).toBe("https://tiles.openfreemap.org/styles/dark");

    const outdoorStyle = getMapStyle("outdoor", config);
    expect(outdoorStyle).toEqual(buildOutdoorRasterStyle());
    expect(outdoorStyle.version).toBe(8);
    expect(outdoorStyle.glyphs).toContain("tiles.openfreemap.org/fonts/");
    expect(outdoorStyle.sources.opentopomap.attribution).toContain("OpenStreetMap");
    expect(outdoorStyle.sources.opentopomap.attribution).toContain("OpenTopoMap");
  });

  test("reads meta[name='map-config'] and selects MapTiler or Stadia when keys exist", () => {
    const meta = document.createElement("meta");
    meta.name = "map-config";
    meta.content = JSON.stringify({
      provider: "auto",
      maptiler_key: "mt_test_123",
      stadia_key: "st_test_456"
    });
    document.head.appendChild(meta);

    const parsed = getMapConfig();
    expect(resolveMapProvider(parsed)).toBe("maptiler");
    expect(getMapStyle("streets", parsed)).toBe(
      "https://api.maptiler.com/maps/streets-v2/style.json?key=mt_test_123"
    );
    expect(getMapStyle("outdoors-v11", parsed)).toBe(
      "https://api.maptiler.com/maps/outdoor-v2/style.json?key=mt_test_123"
    );

    const stadiaOnly = { provider: "auto", maptiler_key: "", stadia_key: "st_test_456" };
    expect(resolveMapProvider(stadiaOnly)).toBe("stadia");
    expect(getMapStyle("dark-v10", stadiaOnly)).toBe(
      "https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=st_test_456"
    );
  });
});
