import { useEffect, useRef, useState } from "react";
import { loadFaceApi } from "@/lib/face-api-loader";
import type { Identity } from "@/lib/face-store";

export type Match = {
  box: { x: number; y: number; width: number; height: number };
  label: string; // person name or "UNIDENTIFIED"
  identityId: string | null;
  confidence: number; // 0..1
  distance: number;
};

const THRESHOLD = 0.5; // euclidean distance threshold

// Continuously detect+recognize faces and report matches via callback.
export function useFaceRecognition(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  identities: Identity[],
  enabled: boolean,
  onMatches: (m: Match[], displaySize: { w: number; h: number }) => void,
) {
  const idsRef = useRef(identities);
  idsRef.current = identities;
  const cbRef = useRef(onMatches);
  cbRef.current = onMatches;

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let raf = 0;

    (async () => {
      const faceapi = await loadFaceApi();
      setBusy(true);
      const opts = new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.5,
      });

      // Build labeled descriptors when there are enrolled faces.
      const buildMatcher = () => {
        const ids = idsRef.current;
        if (ids.length === 0) return null;
        const labeled = ids.map(
          (i) =>
            new faceapi.LabeledFaceDescriptors(i.id, [
              new Float32Array(i.descriptor),
            ]),
        );
        return new faceapi.FaceMatcher(labeled, THRESHOLD);
      };

      const tick = async () => {
        if (!alive) return;
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          raf = requestAnimationFrame(tick);
          return;
        }
        try {
          const detections = await faceapi
            .detectAllFaces(video, opts)
            .withFaceLandmarks()
            .withFaceDescriptors();

          const matcher = buildMatcher();
          const sourceW = video.videoWidth;
          const sourceH = video.videoHeight;
          const displayW = video.clientWidth;
          const displayH = video.clientHeight;
          const scaleX = displayW / sourceW;
          const scaleY = displayH / sourceH;

          const matches: Match[] = detections.map((d) => {
            const best = matcher ? matcher.findBestMatch(d.descriptor) : null;
            const matched = best && best.label !== "unknown";
            const id = matched ? best.label : null;
            const identity = id ? idsRef.current.find((i) => i.id === id) : undefined;
            const distance = best ? best.distance : 1;
            const confidence = Math.max(0, Math.min(1, 1 - distance));
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
            };
          });

          cbRef.current(matches, { w: displayW, h: displayH });
        } catch {
          // ignore intermittent frame errors
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      setBusy(false);
    };
  }, [enabled, videoRef]);

  return { busy };
}
