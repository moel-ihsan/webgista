let modelPromise = null;

/**
 * Lazily load TensorFlow.js backends and the pre-trained COCO-SSD object detector.
 *
 * @returns {Promise<import('@tensorflow-models/coco-ssd').ObjectDetection>}
 */
export async function loadCocoSsdModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      await import("@tensorflow/tfjs");
      await import("@tensorflow/tfjs-backend-cpu");
      await import("@tensorflow/tfjs-backend-webgl");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      return cocoSsd.load();
    })();
  }

  return modelPromise;
}

export function resetCocoSsdCache() {
  modelPromise = null;
}
