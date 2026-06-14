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
  videoRef: React.RefObject<HTMLVideoElement | null>,
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
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          timer = window.setTimeout(tick, 200);
          return;
        }
        try {
          const s = loadSettings();
          const wantExtras =
            optsRef.current.withExtras &&
            (s.showAge || s.showEmotion || s.showGender);

          let chain = faceapi
            .detectAllFaces(video, detectorOpts)
            .withFaceLandmarks()
            .withFaceDescriptors();

          // face-api requires withFaceLandmarks before withFaceExpressions/withAgeAndGender
          // but withFaceDescriptors returns FaceLandmarks+Descriptor object; chain extras separately.
          const detections = await chain;
          let extras: Array<{ age: number; gender: string; genderProbability: number; expressions?: Record<string, number> }> = [];
          if (wantExtras && detections.length) {
            try {
              const extra = await faceapi
                .detectAllFaces(video, detectorOpts)
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
          const sourceW = video.videoWidth;
          const sourceH = video.videoHeight;
          const displayW = video.clientWidth;
          const displayH = video.clientHeight;
          const scaleX = displayW / Math.max(1, sourceW);
          const scaleY = displayH / Math.max(1, sourceH);

          const matches: Match[] = detections.map((d, idx) => {
            const best = matcher ? matcher.findBestMatch(d.descriptor) : null;
            const matched = best && best.label !== "unknown";
            const id = matched ? best.label : null;
            const identity = id ? idsRef.current.find((i) => i.id === id) : undefined;
            const distance = best ? best.distance : 1;
            const confidence = Math.max(0, Math.min(1, 1 - distance));

            // Map extras by nearest box center.
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
              // Don't log unknowns unless user wants them shown.
              if (!m.identityId && !s.showUnknown) continue;
              lastLogRef.current.set(key, now);
              const thumb = snapshotVideo(video, 96);
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
  }, [enabled, videoRef]);

  return { busy };
}
