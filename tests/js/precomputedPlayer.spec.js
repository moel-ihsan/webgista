import {
  getSimulationConfig,
  normalizeCameraSlug,
  resolveCameraSimulation
} from "@/config/simulation";
import httpClient from "@/services/api/httpClient";
import {
  fetchPrecomputedDetections,
  findFrameAtTime,
  getSynchronizedDetections,
  scaleDetections
} from "@/services/traffic/precomputedPlayer";

jest.mock("@/services/api/httpClient", () => ({
  get: jest.fn()
}));

describe("precomputedPlayer & simulation config", () => {
  const samplePayload = {
    width: 640,
    height: 360,
    duration: 30,
    frames: [
      { t: 0, detections: [{ class: "car", score: 0.91, bbox: [100, 200, 60, 40] }] },
      {
        t: 5.5,
        detections: [
          { class: "motorcycle", score: 0.88, bbox: [150, 220, 30, 30] },
          { class: "car", score: 0.72, bbox: [10, 10, 40, 20] }
        ]
      }
    ]
  };

  afterEach(() => {
    document.head.innerHTML = "";
    jest.clearAllMocks();
  });

  test("parses simulation meta tag and resolves camera settings safely", () => {
    expect(getSimulationConfig()).toEqual({
      enabled: false,
      defaultMode: "live",
      bannerText: "",
      cameras: {}
    });

    const meta = document.createElement("meta");
    meta.name = "webgista-simulation";
    meta.content = JSON.stringify({
      enabled: true,
      default_mode: "live",
      banner_text: "SIMULASI DEMO",
      cameras: {
        "simpang-pdam": {
          name: "Simpang PDAM",
          video_url: "/demo/videos/simpang-pdam.mp4",
          precomputed_url: "/demo/detections/simpang-pdam.json",
          default_roi: {
            rec1x: 10,
            rec1y: 20,
            rec2x: 100,
            rec2y: 20,
            rec3x: 100,
            rec3y: 120,
            rec4x: 50,
            rec4y: 130,
            rec5x: 10,
            rec5y: 100
          }
        }
      }
    });
    document.head.appendChild(meta);

    const cfg = getSimulationConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.bannerText).toBe("SIMULASI DEMO");
    expect(normalizeCameraSlug("Simpang PDAM")).toBe("simpang-pdam");

    const resolved = resolveCameraSimulation({ name: "Simpang PDAM", url: "" }, cfg);
    expect(resolved.videoUrl).toBe("/demo/videos/simpang-pdam.mp4");
    expect(resolved.precomputedUrl).toBe("/demo/detections/simpang-pdam.json");
    expect(resolved.defaultRoi.rec1x).toBe(10);
  });

  test("finds frame at timestamp including loop rollover and handles empty arrays", () => {
    expect(findFrameAtTime([], 3)).toBeNull();
    expect(findFrameAtTime(samplePayload.frames, -1).t).toBe(0);
    expect(findFrameAtTime(samplePayload.frames, 2.4).t).toBe(0);
    expect(findFrameAtTime(samplePayload.frames, 5.5).t).toBe(5.5);
    expect(findFrameAtTime(samplePayload.frames, 29.5).t).toBe(5.5);
    // Looping back to 0 selects the initial frame
    expect(findFrameAtTime(samplePayload.frames, 0.2).t).toBe(0);
  });

  test("scales detections and filters by ROI polygon", () => {
    const scaled = scaleDetections(
      samplePayload.frames[1].detections,
      { width: 640, height: 360 },
      { width: 1280, height: 720 }
    );
    expect(scaled[0].bbox).toEqual([300, 440, 60, 60]);

    const roi = [
      { x: 100, y: 150 },
      { x: 500, y: 150 },
      { x: 500, y: 350 },
      { x: 300, y: 350 },
      { x: 100, y: 300 }
    ];

    const synced = getSynchronizedDetections(samplePayload, 5.8, { width: 640, height: 360 }, roi);
    expect(synced.frameTime).toBe(5.5);
    expect(synced.detections).toHaveLength(1);
    expect(synced.detections[0].class).toBe("motorcycle");
  });

  test("fetches and validates precomputed JSON payload", async () => {
    httpClient.get.mockResolvedValueOnce({ data: samplePayload });
    const parsed = await fetchPrecomputedDetections("/demo/detections/simpang-pdam.json");
    expect(parsed.frames).toHaveLength(2);

    httpClient.get.mockResolvedValueOnce({ data: { frames: [] } });
    await expect(fetchPrecomputedDetections("/bad.json")).rejects.toThrow(
      "Invalid precomputed detection payload"
    );
  });
});
