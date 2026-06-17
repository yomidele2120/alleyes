import { useEffect, useRef, useState } from "react";
import { loadFaceApi, loadExtras } from "@/lib/face-api-loader";
import { bumpDetection, type Identity } from "@/lib/face-store";
import { addLogEntry } from "@/lib/detection-log";
import { loadSettings } from "@/lib/settings-store";
import { snapshotVideo } from "@/lib/utils-misc";

export type Match = {
  box: { x: number; y: number; width: number; height: number };
  label: string;
  identityId: string | null;
  confidence: number; // 0..1
  distance: number;
  age?: number;
  gender?: string;
  genderProbability?: number;
  expression?: string;
};

export type RecognitionOptions = {
  feedName?: string;
  withExtras?: boolean;
  /** Run detection at most this often (ms). Default 120. */
  intervalMs?: number;
  /** Auto-log detections (throttled per identity). Default true. */
  autoLog?: boolean;
};

const LOG_THROTTLE_MS = 10_000;

export function useFaceRecognition(
  sourceRef: React.RefObject<HTMLVideoElement | HTMLCanvasElement | null>,
  identities: Identity[],
  enabled: boolean,
  onMatches: (m: Match[], displaySize: { w: number; h: number }) => void,
  options: RecognitionOptions = {},
) {
  const idsRef = useRef(identities);
  idsRef.current = identities;
  const cbRef = useRef(onMatches);
  cbRef.current = onMatches;
  const optsRef = useRef(options);
  optsRef.current = options;

  const lastLogRef = useRef<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: number | null = null;

    (async () => {
      const faceapi = await loadFaceApi();
      const settings = loadSettings();
      if (options.withExtras && (settings.showAge || settings.showEmotion || settings.showGender)) {
        try { await loadExtras(); } catch { /* ignore */ }
      }
      setBusy(true);

      const detectorOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });

      const buildMatcher = () => {
        const ids = idsRef.current;
        if (ids.length === 0) return null;
        const labeled = ids.map(
          (i) =>
            new faceapi.LabeledFaceDescriptors(
              i.id,
              (i.descriptors.length ? i.descriptors : [[]]).map(
                (d) => new Float32Array(d),
              ),
            ),
        );
        const s = loadSettings();
        // settings.confidenceThreshold is "confidence"; face-api distance is inverse.
        // distance ~ 1 - confidence
        return new faceapi.FaceMatcher(labeled, 1 - s.confidenceThreshold);
      };

      const tick = async () => {
        if (!alive) return;
        const src = sourceRef.current;
        const isVideo = src instanceof HTMLVideoElement;
        const isCanvas = src instanceof HTMLCanvasElement;
        if (!src || (isVideo && (src as HTMLVideoElement).readyState < 2) || (isCanvas && (src as HTMLCanvasElement).width === 0)) {
          timer = window.setTimeout(tick, 200);
          return;
        }
        try {
          const s = loadSettings();
          const wantExtras =
            optsRef.current.withExtras &&
            (s.showAge || s.showEmotion || s.showGender);

          const detections = await faceapi
            .detectAllFaces(src as HTMLVideoElement, detectorOpts)
            .withFaceLandmarks()
            .withFaceDescriptors();
          let extras: Array<{ age: number; gender: string; genderProbability: number; expressions?: Record<string, number> }> = [];
          if (wantExtras && detections.length) {
            try {
              const extra = await faceapi
                .detectAllFaces(src as HTMLVideoElement, detectorOpts)
                .withFaceLandmarks()
                .withFaceExpressions()
                .withAgeAndGender();
              extras = extra.map((e) => ({
                age: e.age,
                gender: e.gender,
                genderProbability: e.genderProbability,
                expressions: e.expressions as unknown as Record<string, number>,
              }));
            } catch { /* extras not ready */ }
          }

          const matcher = buildMatcher();
          const sourceW = isVideo ? (src as HTMLVideoElement).videoWidth : (src as HTMLCanvasElement).width;
          const sourceH = isVideo ? (src as HTMLVideoElement).videoHeight : (src as HTMLCanvasElement).height;
          const displayW = (src as HTMLElement).clientWidth;
          const displayH = (src as HTMLElement).clientHeight;
          // object-fit: cover math — pick the larger scale so the source fills
          // the display, then offset by the cropped overflow so bounding boxes
          // land on the actual face in the visible frame.
          const cover = Math.max(displayW / Math.max(1, sourceW), displayH / Math.max(1, sourceH));
          const scaleX = cover;
          const scaleY = cover;
          const offsetX = (displayW - sourceW * cover) / 2;
          const offsetY = (displayH - sourceH * cover) / 2;

          const matches: Match[] = detections.map((d, idx) => {
            const best = matcher ? matcher.findBestMatch(d.descriptor) : null;
            const matched = best && best.label !== "unknown";
            const id = matched ? best.label : null;
            const identity = id ? idsRef.current.find((i) => i.id === id) : undefined;
            const distance = best ? best.distance : 1;
            const confidence = Math.max(0, Math.min(1, 1 - distance));

            let age: number | undefined;
            let gender: string | undefined;
            let genderProbability: number | undefined;
            let expression: string | undefined;
            if (extras[idx]) {
              const e = extras[idx];
              age = e.age;
              gender = e.gender;
              genderProbability = e.genderProbability;
              if (e.expressions) {
                expression = Object.entries(e.expressions).sort((a, b) => b[1] - a[1])[0]?.[0];
              }
            }

            return {
              box: {
                x: d.detection.box.x * scaleX,
                y: d.detection.box.y * scaleY,
                width: d.detection.box.width * scaleX,
                height: d.detection.box.height * scaleY,
              },
              identityId: id,
              label: identity ? identity.name : "UNIDENTIFIED",
              confidence,
              distance,
              age,
              gender,
              genderProbability,
              expression,
            };
          });

          // Auto-log + bump detection counts (throttled).
          if (optsRef.current.autoLog !== false && s.autoSnapshot) {
            const feed = optsRef.current.feedName || "Local Camera";
            const now = Date.now();
            for (const m of matches) {
              const key = `${m.identityId ?? "u"}:${feed}`;
              const last = lastLogRef.current.get(key) || 0;
              if (now - last < LOG_THROTTLE_MS) continue;
              if (!m.identityId && !s.showUnknown) continue;
              lastLogRef.current.set(key, now);
              const thumb = snapshotSource(src, 96);
              addLogEntry({
                identityId: m.identityId,
                name: m.label,
                feed,
                time: now,
                confidence: m.confidence,
                thumbnail: thumb,
              });
              if (m.identityId) bumpDetection(m.identityId);
            }
          }

          cbRef.current(matches, { w: displayW, h: displayH });
        } catch {
          // ignore intermittent frame errors
        }
        timer = window.setTimeout(tick, optsRef.current.intervalMs ?? 120);
      };
      tick();
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      setBusy(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sourceRef]);

  return { busy };
}

function snapshotSource(src: HTMLVideoElement | HTMLCanvasElement, size: number): string {
  try {
    if (src instanceof HTMLVideoElement) return snapshotVideo(src, size);
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(src, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}
