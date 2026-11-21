import {
  ANALYSIS_WINDOW_SECONDS,
  DEFAULT_CAPACITY_PARAMS,
  DEFAULT_CAPACITY_PER_HOUR,
  NO_DATA_LEVEL,
  PCU_WEIGHTS,
  REGULAR_CAMERA_LEVEL,
  TRAFFIC_LEVELS,
  calculatePcuVolume,
  calculateRoadCapacity,
  calculateVcRatio,
  classifyTrafficWindow,
  classifyVcRatio,
  convertWindowVolumeToHourly,
  countDetectionsByCategory,
  getColorForCondition,
  mapCocoClassToCategory,
  resolvePointStatus
} from "../../resources/js/services/traffic/ihcmClassifier";

describe("ihcmClassifier (IHCM 1997)", () => {
  test("computes intersection capacity C = C0 * FCw * FCsp * FCsf * FCcs * lanes = 4455", () => {
    expect(calculateRoadCapacity(DEFAULT_CAPACITY_PARAMS)).toBeCloseTo(4455, 6);
    expect(DEFAULT_CAPACITY_PER_HOUR).toBe(4455);
  });

  test("applies IHCM 1997 PCU weights (LV=1.0, HV=1.3, MC=0.4)", () => {
    expect(PCU_WEIGHTS).toEqual({ LV: 1.0, HV: 1.3, MC: 0.4 });
    expect(calculatePcuVolume({ lv: 1, hv: 0, mc: 0 })).toBeCloseTo(1.0, 6);
    expect(calculatePcuVolume({ lv: 0, hv: 1, mc: 0 })).toBeCloseTo(1.3, 6);
    expect(calculatePcuVolume({ lv: 0, hv: 0, mc: 1 })).toBeCloseTo(0.4, 6);
    expect(calculatePcuVolume({ lv: 10, hv: 5, mc: 10 })).toBeCloseTo(20.5, 6);
  });

  test("converts 30-second window volume to hourly smp/hour using factor 120", () => {
    expect(ANALYSIS_WINDOW_SECONDS).toBe(30);
    expect(convertWindowVolumeToHourly(20.5, 30)).toBeCloseTo(2460, 6);
    expect(() => convertWindowVolumeToHourly(10, 0)).toThrow();
  });

  test("maps COCO-SSD classes accurately while preserving person in MC and ignoring unrelated classes", () => {
    expect(mapCocoClassToCategory("car")).toBe("LV");
    expect(mapCocoClassToCategory("truck")).toBe("HV");
    expect(mapCocoClassToCategory("bus")).toBe("HV");
    expect(mapCocoClassToCategory("motorcycle")).toBe("MC");
    expect(mapCocoClassToCategory("bicycle")).toBe("MC");
    expect(mapCocoClassToCategory("person")).toBe("MC");

    expect(mapCocoClassToCategory("traffic light")).toBeNull();
    expect(mapCocoClassToCategory("dog")).toBeNull();
    expect(mapCocoClassToCategory("airplane")).toBeNull();
    expect(mapCocoClassToCategory("boat")).toBeNull();
    expect(mapCocoClassToCategory(null)).toBeNull();

    const summary = countDetectionsByCategory([
      { class: "car", bbox: [0, 0, 10, 10] },
      { class: "truck", bbox: [0, 0, 10, 10] },
      { class: "bus", bbox: [0, 0, 10, 10] },
      { class: "motorcycle", bbox: [0, 0, 10, 10] },
      { class: "bicycle", bbox: [0, 0, 10, 10] },
      { class: "person", bbox: [0, 0, 10, 10] },
      { class: "traffic light", bbox: [0, 0, 10, 10] },
      { class: "chair", bbox: [0, 0, 10, 10] }
    ]);

    expect(summary.lv).toBe(1);
    expect(summary.hv).toBe(2);
    expect(summary.mc).toBe(3);
    expect(summary.total).toBe(6);
    expect(summary.matchedDetections).toHaveLength(6);
  });

  test("classifies every V/C threshold A through F and exact marker colors", () => {
    const cases = [
      { vc: 0, grade: "A", label: "Great", color: "#98FB98" },
      { vc: 0.5999, grade: "A", label: "Great", color: "#98FB98" },
      { vc: 0.6, grade: "B", label: "Good", color: "#0B6623" },
      { vc: 0.6999, grade: "B", label: "Good", color: "#0B6623" },
      { vc: 0.7, grade: "C", label: "Average", color: "#FFFF00" },
      { vc: 0.7999, grade: "C", label: "Average", color: "#FFFF00" },
      { vc: 0.8, grade: "D", label: "Poor", color: "#D4A328" },
      { vc: 0.8999, grade: "D", label: "Poor", color: "#D4A328" },
      { vc: 0.9, grade: "E", label: "Bad", color: "#FF5F00" },
      { vc: 1.0, grade: "E", label: "Bad", color: "#FF5F00" },
      { vc: 1.0001, grade: "F", label: "Terrible", color: "#FF0000" }
    ];

    cases.forEach(({ vc, grade, label, color }) => {
      const result = classifyVcRatio(vc);
      expect(result.grade).toBe(grade);
      expect(result.label).toBe(label);
      expect(result.color).toBe(color);
      expect(getColorForCondition(label)).toBe(color);
    });

    expect(classifyVcRatio(-0.1)).toEqual(NO_DATA_LEVEL);
    expect(classifyVcRatio(Number.NaN)).toEqual(NO_DATA_LEVEL);
    expect(getColorForCondition("Unknown")).toBe("#0000FF");
    expect(TRAFFIC_LEVELS).toHaveLength(6);
  });

  test("computes V/C ratio and classification for 30-second intersection captures", () => {
    // 10 LV + 5 HV + 10 MC = 20.5 PCU in 30s -> 2460 smp/h -> V/C = 2460/4455 = 0.55218... (A / Great)
    const great = classifyTrafficWindow({ lv: 10, hv: 5, mc: 10, windowSeconds: 30 });
    expect(great.hourlyPcu).toBeCloseTo(2460, 6);
    expect(great.vcRatio).toBeCloseTo(2460 / 4455, 6);
    expect(great.grade).toBe("A");
    expect(great.label).toBe("Great");

    // 40 LV in 30s -> 4800 smp/h -> V/C = 4800/4455 = 1.0774... (F / Terrible)
    const terrible = classifyTrafficWindow({ lv: 40, hv: 0, mc: 0, windowSeconds: 30 });
    expect(terrible.grade).toBe("F");
    expect(terrible.label).toBe("Terrible");
    expect(calculateVcRatio({ lv: 40, hv: 0, mc: 0 })).toBeCloseTo(4800 / 4455, 6);
  });

  test("resolves Regular cameras cleanly without traffic detection and keeps Analytic No Data separate", () => {
    expect(resolvePointStatus("Regular", "Great")).toEqual({
      grade: REGULAR_CAMERA_LEVEL.grade,
      chipCode: "R",
      label: REGULAR_CAMERA_LEVEL.label,
      color: REGULAR_CAMERA_LEVEL.color,
      isRegular: true
    });
    expect(resolvePointStatus("Regular", "No Data").grade).toBe("R");

    expect(resolvePointStatus("Analytic", "No Data")).toEqual({
      grade: "?",
      chipCode: "N",
      label: "No Data",
      color: NO_DATA_LEVEL.color,
      isRegular: false
    });
    expect(resolvePointStatus("Analytic", "Poor")).toMatchObject({
      grade: "D",
      chipCode: "D",
      label: "Poor",
      isRegular: false
    });
  });
});
