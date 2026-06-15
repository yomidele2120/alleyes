import { useEffect, useRef, useState } from "react";

type Options = { facingMode?: "user" | "environment" };

export function useCamera({ facingMode = "user" }: Options = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied">(
    "prompt",
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    (async () => {
      try {
        setReady(false);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setPermission("granted");

        // Try to enable continuous exposure/white-balance/focus for low-light.
        try {
          const track = stream.getVideoTracks()[0];
          // getCapabilities is not in lib.dom.d.ts on all browsers
          const caps = (track as MediaStreamTrack & {
            getCapabilities?: () => Record<string, unknown>;
          }).getCapabilities?.();
          const advanced: MediaTrackConstraintSet[] = [];
          if (caps?.exposureMode) advanced.push({ exposureMode: "continuous" } as MediaTrackConstraintSet);
          if (caps?.whiteBalanceMode) advanced.push({ whiteBalanceMode: "continuous" } as MediaTrackConstraintSet);
          if (caps?.focusMode) advanced.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
          if (advanced.length) {
            await track.applyConstraints({ advanced }).catch(() => {});
          }
        } catch { /* hardware doesn't support advanced constraints */ }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setPermission("denied");
        const err = e as { name?: string; message?: string };
        if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
          setError("Camera access required. Please allow camera permission and refresh.");
        } else {
          setError(err?.message || "Camera unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return { videoRef, error, ready, permission };
}
