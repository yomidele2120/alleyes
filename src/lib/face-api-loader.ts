// Client-only face-api.js loader. Loads the library via <script> from unpkg
// and the weights from unpkg with a GitHub raw fallback.
// Core models load eagerly; age/gender/expression load on demand.
import type * as FaceApi from "face-api.js";

declare global {
  interface Window {
    faceapi?: typeof FaceApi;
  }
}

const LIB_URL = "https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js";
const WEIGHT_URLS = [
  "https://unpkg.com/face-api.js@0.22.2/weights",
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights",
];

let loadPromise: Promise<typeof FaceApi> | null = null;
let extrasPromise: Promise<void> | null = null;
let workingWeightUrl: string | null = null;

function injectScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") return reject(new Error("no document"));
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-faceapi="1"]`,
    );
    if (existing) {
      if (window.faceapi) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.faceapi = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load face-api.js"));
    document.head.appendChild(s);
  });
}

export function loadFaceApi(onProgress?: (msg: string) => void): Promise<typeof FaceApi> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    onProgress?.("Loading runtime...");
    await injectScript(LIB_URL);
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error("face-api.js did not initialize");

    let lastErr: unknown = null;
    for (const url of WEIGHT_URLS) {
      try {
        onProgress?.("Loading detector...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(url);
        onProgress?.("Loading landmarks...");
        await faceapi.nets.faceLandmark68Net.loadFromUri(url);
        onProgress?.("Loading recognition...");
        await faceapi.nets.faceRecognitionNet.loadFromUri(url);
        workingWeightUrl = url;
        console.log("[LENS] Models loaded from:", url);
        onProgress?.("LENS Ready");
        return faceapi;
      } catch (e) {
        console.warn("[LENS] Failed to load models from:", url, e);
        lastErr = e;
      }
    }
    throw new Error(
      "Could not load AI models. Check your connection and refresh." +
        (lastErr instanceof Error ? ` (${lastErr.message})` : ""),
    );
  })();
  return loadPromise;
}

/** Loads age/gender + expression models (lazy, idempotent). */
export function loadExtras(): Promise<void> {
  if (extrasPromise) return extrasPromise;
  extrasPromise = (async () => {
    const faceapi = await loadFaceApi();
    const url = workingWeightUrl || WEIGHT_URLS[0];
    try {
      await Promise.all([
        faceapi.nets.faceExpressionNet.loadFromUri(url),
        faceapi.nets.ageGenderNet.loadFromUri(url),
      ]);
    } catch (e) {
      console.warn("[LENS] Failed to load extras", e);
      extrasPromise = null;
      throw e;
    }
  })();
  return extrasPromise;
}
