import {
  drawRoiPolygon,
  extractRoiPoints,
  filterDetectionsByRoi,
  isPointInPolygon,
  isValidRoi,
  polygonArea,
  serializeRoiPoints
} from "../../resources/js/services/traffic/roiGeometry";

describe("roiGeometry", () => {
  const sampleRecord = {
    rec1x: 10,
    rec1y: 20,
    rec2x: 110,
    rec2y: 20,
    rec3x: 120,
    rec3y: 120,
    rec4x: 60,
    rec4y: 160,
    rec5x: 10,
    rec5y: 100
  };

  test("extracts all 5 vertices including rec4y (fixing legacy rec4x typo)", () => {
    const points = extractRoiPoints(sampleRecord);
    expect(points).toHaveLength(5);
    expect(points[3]).toEqual({ x: 60, y: 160 });
  });

  test("returns empty array when any vertex is missing or invalid", () => {
    expect(extractRoiPoints({})).toEqual([]);
    expect(extractRoiPoints({ ...sampleRecord, rec4y: null })).toEqual([]);
    expect(extractRoiPoints({ ...sampleRecord, rec2x: -5 })).toEqual([]);
  });

  test("validates polygon area and rejects degenerate shapes", () => {
    const valid = extractRoiPoints(sampleRecord);
    expect(isValidRoi(valid)).toBe(true);
    expect(polygonArea(valid)).toBeGreaterThan(0);

    const collinear = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 }
    ];
    expect(isValidRoi(collinear)).toBe(false);
    expect(isValidRoi([{ x: 0, y: 0 }])).toBe(false);
  });

  test("serializes 5 vertices to API payload and draws/clips canvas context", () => {
    const points = extractRoiPoints(sampleRecord);
    expect(serializeRoiPoints(points)).toEqual(sampleRecord);
    expect(() => serializeRoiPoints([])).toThrow();

    const ctx = {
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      clip: jest.fn()
    };

    expect(drawRoiPolygon(ctx, points, { strokeStyle: "blue", lineWidth: 5 })).toBe(true);
    expect(ctx.moveTo).toHaveBeenCalledWith(10, 20);
    expect(ctx.lineTo).toHaveBeenCalledWith(60, 160);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);

    expect(drawRoiPolygon(ctx, points, { clip: true })).toBe(true);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  test("filters detections by polygon containment using bbox center", () => {
    const polygon = extractRoiPoints(sampleRecord);
    expect(isPointInPolygon({ x: 60, y: 80 }, polygon)).toBe(true);
    expect(isPointInPolygon({ x: 200, y: 80 }, polygon)).toBe(false);

    const detections = [
      { class: "car", bbox: [40, 60, 40, 40] },
      { class: "motorcycle", bbox: [180, 70, 30, 30] }
    ];

    const filtered = filterDetectionsByRoi(detections, polygon);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].class).toBe("car");

    expect(filterDetectionsByRoi(detections, [])).toHaveLength(2);
  });
});
