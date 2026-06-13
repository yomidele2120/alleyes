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
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setPermission("granted");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        setPermission("denied");
        setError(e instanceof Error ? e.message : "Camera unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode]);

  return { videoRef, error, ready, permission };
}
