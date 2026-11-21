import { TrafficWindowTracker } from "../../resources/js/services/traffic/windowTracker";

describe("TrafficWindowTracker", () => {
  test("accumulates counts within a 30-second window and resets to 0 when capture changes", () => {
    const tracker = new TrafficWindowTracker(30, 4455);

    const first = tracker.recordCapture([{ class: "car" }, { class: "person" }], 0);
    expect(first.windowReset).toBe(true);
    expect(first.shouldPersist).toBe(true);
    expect(first.counts).toEqual({ lv: 1, hv: 0, mc: 1 });

    // Within same 30s window -> accumulates
    const second = tracker.recordCapture([{ class: "truck" }, { class: "car" }], 15);
    expect(second.windowReset).toBe(false);
    expect(second.counts).toEqual({ lv: 2, hv: 1, mc: 1 });
    expect(second.classification.label).toBe("Great");

    // Reaches 30s -> resets counts to 0 before recording new capture
    const nextWindow = tracker.recordCapture([{ class: "bus" }], 30);
    expect(nextWindow.windowReset).toBe(true);
    expect(nextWindow.shouldPersist).toBe(true);
    expect(nextWindow.counts).toEqual({ lv: 0, hv: 1, mc: 0 });
    expect(nextWindow.completedClassification.lv).toBe(2);
    expect(nextWindow.completedClassification.hv).toBe(1);
  });

  test("resets counts to 0 when looping video jumps back in timestamp", () => {
    const tracker = new TrafficWindowTracker(30, 4455);

    tracker.recordCapture([{ class: "car" }, { class: "car" }], 10);
    const afterLoop = tracker.recordCapture([{ class: "motorcycle" }], 1);

    expect(afterLoop.windowReset).toBe(true);
    expect(afterLoop.counts).toEqual({ lv: 0, hv: 0, mc: 1 });
  });
});
