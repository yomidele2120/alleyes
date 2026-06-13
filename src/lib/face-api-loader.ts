// Client-only face-api.js loader. face-api uses DOM/WebGL — never import on server.
let loadPromise: Promise<typeof import("face-api.js")> | null = null;

const MODEL_URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

export function loadFaceApi(onProgress?: (msg: string) => void) {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    onProgress?.("Loading runtime...");
    const faceapi = await import("face-api.js");
    onProgress?.("Loading detector...");
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    onProgress?.("Loading landmarks...");
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    onProgress?.("Loading recognition...");
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    onProgress?.("LENS Ready");
    return faceapi;
  })();
  return loadPromise;
}
