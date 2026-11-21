import {
  drawRoiPolygon,
  extractRoiPoints,
  filterDetectionsByRoi,
  isPointInPolygon,
  isValidRoi,
  mapClientPointToCanvas,
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

  const trianglePoints = [
    { x: 50, y: 40 },
    { x: 250, y: 40 },
    { x: 150, y: 200 }
  ];

  const quadPoints = [
    { x: 20, y: 20 },
    { x: 220, y: 20 },
    { x: 240, y: 180 },
    { x: 10, y: 180 }
  ];

  const heptagonPoints = [
    { x: 100, y: 40 },
    { x: 220, y: 30 },
    { x: 340, y: 80 },
    { x: 380, y: 180 },
    { x: 290, y: 270 },
    { x: 120, y: 260 },
    { x: 60, y: 140 }
  ];

  test("extracts legacy 5 vertices and prioritizes arbitrary roi_polygon arrays", () => {
    const legacy = extractRoiPoints(sampleRecord);
    expect(legacy).toHaveLength(5);
    expect(legacy[3]).toEqual({ x: 60, y: 160 });

    const withPolygon = extractRoiPoints({
      ...sampleRecord,
      roi_polygon: heptagonPoints
    });
    expect(withPolygon).toEqual(heptagonPoints);
    expect(extractRoiPoints(trianglePoints)).toEqual(trianglePoints);
    expect(extractRoiPoints(quadPoints)).toEqual(quadPoints);
  });

  test("returns empty array when any vertex is missing or invalid", () => {
    expect(extractRoiPoints({})).toEqual([]);
    expect(extractRoiPoints({ ...sampleRecord, rec4y: null })).toEqual([]);
    expect(extractRoiPoints({ ...sampleRecord, rec2x: -5 })).toEqual([]);
    expect(
      extractRoiPoints({
        roi_polygon: [
          { x: 10, y: 10 },
          { x: 20, y: 30 }
        ]
      })
    ).toEqual([]);
    expect(
      extractRoiPoints({
        roi_polygon: [
          { x: 10, y: 10 },
          { x: -1, y: 20 },
          { x: 40, y: 50 }
        ]
      })
    ).toEqual([]);
  });

  test("validates N >= 3 polygon areas and rejects degenerate shapes", () => {
    expect(isValidRoi(trianglePoints)).toBe(true);
    expect(isValidRoi(quadPoints)).toBe(true);
    expect(isValidRoi(extractRoiPoints(sampleRecord))).toBe(true);
    expect(isValidRoi(heptagonPoints)).toBe(true);
    expect(polygonArea(trianglePoints)).toBeGreaterThan(0);

    const collinear = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 }
    ];
    expect(isValidRoi(collinear)).toBe(false);
    expect(isValidRoi([])).toBe(false);
    expect(isValidRoi([{ x: 0, y: 0 }])).toBe(false);
    expect(
      isValidRoi([
        { x: 0, y: 0 },
        { x: 50, y: 50 }
      ])
    ).toBe(false);
  });

  test("serializes arbitrary N >= 3 vertices to points payload and draws/clips canvas", () => {
    expect(serializeRoiPoints(heptagonPoints)).toEqual({ points: heptagonPoints });
    expect(serializeRoiPoints(trianglePoints)).toEqual({ points: trianglePoints });
    expect(() => serializeRoiPoints([])).toThrow();
    expect(() =>
      serializeRoiPoints([
        { x: 0, y: 0 },
        { x: 10, y: 10 }
      ])
    ).toThrow();

    const ctx = {
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      closePath: jest.fn(),
      stroke: jest.fn(),
      clip: jest.fn()
    };

    expect(drawRoiPolygon(ctx, heptagonPoints, { strokeStyle: "blue", lineWidth: 5 })).toBe(true);
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 40);
    expect(ctx.lineTo).toHaveBeenCalledWith(60, 140);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);

    expect(drawRoiPolygon(ctx, trianglePoints, { clip: true })).toBe(true);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
  });

  test("filters detections inside N-point polygons (3-point & 7-point) using bbox center", () => {
    const detections = [
      { class: "car", bbox: [130, 80, 40, 40] },
      { class: "motorcycle", bbox: [320, 180, 30, 30] }
    ];

    const filteredTri = filterDetectionsByRoi(detections, trianglePoints);
    expect(filteredTri).toHaveLength(1);
    expect(filteredTri[0].class).toBe("car");

    expect(isPointInPolygon({ x: 200, y: 150 }, heptagonPoints)).toBe(true);
    expect(isPointInPolygon({ x: 10, y: 10 }, heptagonPoints)).toBe(false);
    expect(filterDetectionsByRoi(detections, heptagonPoints)).toHaveLength(2);
    expect(filterDetectionsByRoi(detections, [])).toHaveLength(2);
  });

  test("maps client coordinates to canvas pixels across fill, cover, and contain", () => {
    const rect = { left: 100, top: 50, width: 800, height: 550 };

    // Center point on 800x550 maps cleanly to (320, 180) on 640x360 under cover, contain, and fill
    expect(
      mapClientPointToCanvas({
        clientX: 500,
        clientY: 325,
        rect,
        canvasWidth: 640,
        canvasHeight: 360,
        objectFit: "cover"
      })
    ).toEqual({ x: 320, y: 180 });

    expect(
      mapClientPointToCanvas({
        clientX: 500,
        clientY: 325,
        rect,
        canvasWidth: 640,
        canvasHeight: 360,
        objectFit: "contain"
      })
    ).toEqual({ x: 320, y: 180 });

    // Clamps outside pointers cleanly within [0, width] x [0, height]
    expect(
      mapClientPointToCanvas({
        clientX: 0,
        clientY: 9999,
        rect,
        canvasWidth: 640,
        canvasHeight: 360,
        objectFit: "fill"
      })
    ).toEqual({ x: 0, y: 360 });
  });
});
