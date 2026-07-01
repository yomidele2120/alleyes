import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Plus, X } from "lucide-react";
import { loadFaceApi } from "@/lib/face-api-loader";
import type { Identity } from "@/lib/face-store";
import { bumpDetection } from "@/lib/face-store";
import { addLogEntry } from "@/lib/detection-log";
import { loadSettings } from "@/lib/settings-store";
import { snapshotVideo, chime } from "@/lib/utils-misc";
import type { Feed } from "@/lib/feed-store";
import { BoundingBox } from "@/components/bounding-box";
import { CameraFrame } from "@/components/camera-frame";
import type { Match } from "@/hooks/use-face-recognition";
import { backendIdentify, type BackendDetection } from "@/lib/lens-backend";
import { backendConnection, normalizeBackendDetections } from "@/lib/lens-backend";
import { useBackendHealth } from "@/hooks/use-backend-health";

const LOG_THROTTLE_MS = 10_000;

export function NetworkTile({
  feed,
  identities,
  targetIds,
  onRemove,
  onTargetFound,
}: {
  feed: Feed;
  identities: Identity[];
  targetIds: Set<string>;
  onRemove: () => void;
  onTargetFound?: (identityId: string, feedName: string) => void;
}) {
  const { status: backendStatus } = useBackendHealth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");
  const [matches, setMatches] = useState<Match[]>([]);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const lastLog = useRef<Map<string, number>>(new Map());
  const announcedTargets = useRef<Set<string>>(new Set());

  // ---- Connect feed ----
  useEffect(() => {
    let stream: MediaStream | null = null;
    let hls: Hls | null = null;
    let cancelled = false;

    (async () => {
      try {
        if (feed.kind === "local") {
          const facing = feed.url === "back" ? "environment" : "user";
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false,
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
            setStatus("live");
          }
        } else if (feed.kind === "hls") {
          if (!videoRef.current) return;
          if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(feed.url);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current?.play().catch(() => {});
              setStatus("live");
            });
            hls.on(Hls.Events.ERROR, () => setStatus("error"));
          } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
            videoRef.current.src = feed.url;
            videoRef.current.addEventListener("loadeddata", () => setStatus("live"));
            videoRef.current.addEventListener("error", () => setStatus("error"));
          } else {
            setStatus("error");
          }
        } else if (feed.kind === "mjpeg") {
          if (imgRef.current) {
            imgRef.current.onload = () => setStatus("live");
            imgRef.current.onerror = () => setStatus("error");
            imgRef.current.src = feed.url;
          }
        } else if (feed.kind === "webrtc") {
          // Placeholder — paste-SDP flow handled in modal.
          setStatus("error");
        }
      } catch (e) {
        console.warn("[LENS] feed connect error", feed, e);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (hls) hls.destroy();
    };
  }, [feed]);

  // ---- Recognition loop ----
  useEffect(() => {
    if (status !== "live") return;
    let alive = true;
    let timer: number | null = null;
    let offDetection: (() => void) | null = null;

    (async () => {
      const faceapi = await loadFaceApi();
      const detectorOpts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
      offDetection = backendConnection.on("detection", (detail) => {
        if (backendStatus !== "insightface") return;
        const payload = detail as { feed_name?: string; camera_name?: string; detections?: unknown };
        const feedName = payload.feed_name || payload.camera_name;
        if (feedName && feedName !== feed.name) return;
        const detections = normalizeBackendDetections(payload.detections ?? detail);
        if (!detections.length) return;
        setMatches(mapBackendDetections(detections));
      });


      const metrics = () => {
        const source: HTMLVideoElement | HTMLImageElement | null =
          feed.kind === "mjpeg" ? imgRef.current : videoRef.current;
        if (!source) return null;
        const sourceW = "videoWidth" in source ? source.videoWidth : source.naturalWidth;
        const sourceH = "videoHeight" in source ? source.videoHeight : source.naturalHeight;
        const displayW = source.clientWidth;
        const displayH = source.clientHeight;
        const cover = Math.max(displayW / Math.max(1, sourceW), displayH / Math.max(1, sourceH));
        return {
          sourceW,
          sourceH,
          displayW,
          displayH,
          scaleX: cover,
          scaleY: cover,
          offsetX: (displayW - sourceW * cover) / 2,
          offsetY: (displayH - sourceH * cover) / 2,
        };
      };

      const mapBackendDetections = (detections: BackendDetection[]): Match[] => {
        const m = metrics();
        if (!m) return [];
        return detections.map((d) => {
          const identity = d.identity_id ? identities.find((i) => i.id === d.identity_id) : undefined;
          return {
            box: {
              x: d.box.x * m.scaleX + m.offsetX,
              y: d.box.y * m.scaleY + m.offsetY,
              width: d.box.w * m.scaleX,
              height: d.box.h * m.scaleY,
            },
            identityId: d.identity_id ?? null,
            label: identity ? identity.name : d.name || "UNIDENTIFIED",
            confidence: Math.max(0, Math.min(1, d.confidence)),
            distance: 1 - Math.max(0, Math.min(1, d.confidence)),
            age: d.age_estimate,
            gender: d.gender,
          };
        });
      };

      const buildMatcher = () => {
        if (identities.length === 0) return null;
        const labeled = identities.map(
          (i) =>
            new faceapi.LabeledFaceDescriptors(
              i.id,
              (i.descriptors.length ? i.descriptors : [[]]).map(
                (d) => new Float32Array(d),
              ),
            ),
        );
        const s = loadSettings();
        return new faceapi.FaceMatcher(labeled, 1 - s.confidenceThreshold);
      };

      const tick = async () => {
        if (!alive) return;
        const source: HTMLVideoElement | HTMLImageElement | null =
          feed.kind === "mjpeg" ? imgRef.current : videoRef.current;
        if (!source) {
          timer = window.setTimeout(tick, 300);
          return;
        }
        try {
          const m = metrics();
          if (!m) {
            timer = window.setTimeout(tick, 250);
            return;
          }

          let ms: Match[] = [];
          if (backendStatus === "insightface") {
            const blob = await captureSourceBlob(source);
            const backendDetections = blob ? await backendIdentify(blob) : null;
            if (backendDetections && backendDetections.length) {
              ms = mapBackendDetections(backendDetections);
            }
          }

          if (!ms.length) {
            const detections = await faceapi
              .detectAllFaces(source, detectorOpts)
              .withFaceLandmarks()
              .withFaceDescriptors();

            const matcher = buildMatcher();
            ms = detections.map((d) => {
              const best = matcher ? matcher.findBestMatch(d.descriptor) : null;
              const matched = best && best.label !== "unknown";
              const id = matched ? best.label : null;
              const identity = id ? identities.find((i) => i.id === id) : undefined;
              const distance = best ? best.distance : 1;
              return {
                box: {
                  x: d.detection.box.x * m.scaleX + m.offsetX,
                  y: d.detection.box.y * m.scaleY + m.offsetY,
                  width: d.detection.box.width * m.scaleX,
                  height: d.detection.box.height * m.scaleY,
                },
                identityId: id,
                label: identity ? identity.name : "UNIDENTIFIED",
                confidence: Math.max(0, Math.min(1, 1 - distance)),
                distance,
              };
            });
          }

          // Auto-log + target detection
          const s = loadSettings();
          const now = Date.now();
          for (const m of ms) {
            const key = `${m.identityId ?? "u"}:${feed.name}`;
            const last = lastLog.current.get(key) || 0;
            if (s.autoSnapshot && now - last >= LOG_THROTTLE_MS) {
              if (m.identityId || s.showUnknown) {
                lastLog.current.set(key, now);
                const thumb =
                  feed.kind === "mjpeg"
                    ? imgRef.current
                      ? imgToDataUrl(imgRef.current)
                      : ""
                    : videoRef.current
                    ? snapshotVideo(videoRef.current, 96)
                    : "";
                addLogEntry({
                  identityId: m.identityId,
                  name: m.label,
                  feed: feed.name,
                  time: now,
                  confidence: m.confidence,
                  thumbnail: thumb,
                });
                if (m.identityId) bumpDetection(m.identityId);
              }
            }
            // Target found alert
            if (
              m.identityId &&
              targetIds.has(m.identityId) &&
              !announcedTargets.current.has(m.identityId)
            ) {
              announcedTargets.current.add(m.identityId);
              if (s.soundAlerts) chime();
              onTargetFound?.(m.identityId, feed.name);
            }
          }

          setMatches(ms);
          setDim({ w: m.displayW, h: m.displayH });
        } catch { /* ignore */ }
        // Throttle: heavier when many tiles
        timer = window.setTimeout(tick, 250);
      };
      tick();
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      offDetection();
    };
  }, [backendStatus, feed, identities, targetIds, onTargetFound]);

  const hasTargetFound = matches.some(
    (m) => m.identityId && targetIds.has(m.identityId),
  );

  return (
    <CameraFrame
      active={status === "live" && !hasTargetFound}
      gold={hasTargetFound}
      className="relative aspect-video w-full"
    >
      {feed.kind === "mjpeg" ? (
        <img
          ref={imgRef}
          alt={feed.name}
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{ width: dim.w || "100%", height: dim.h || "100%" }}
      >
        {matches.map((m, i) => {
          const isTarget = m.identityId && targetIds.has(m.identityId);
          return <BoundingBox key={i} m={m} target={!!isTarget} />;
        })}
      </div>

      {/* Header strip */}
      <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between">
        <div className="glass flex items-center gap-2 rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.25em]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                status === "live"
                  ? "#22C55E"
                  : status === "error"
                  ? "#EF4444"
                  : "var(--muted-foreground)",
              boxShadow:
                status === "live"
                  ? "0 0 8px #22C55E"
                  : status === "error"
                  ? "0 0 8px #EF4444"
                  : "none",
            }}
          />
          {feed.name}
          <span className="ml-1 text-muted-foreground">· {matches.length}</span>
        </div>
        <button
          onClick={onRemove}
          className="pointer-events-auto rounded-full bg-background/70 p-1 text-muted-foreground hover:text-destructive"
          aria-label="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {hasTargetFound && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 animate-gold-pulse rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-background"
             style={{ background: "var(--gold)" }}>
          Target — {feed.name}
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-destructive">
          Stream unavailable
        </div>
      )}
    </CameraFrame>
  );
}

async function captureSourceBlob(src: HTMLVideoElement | HTMLImageElement, size = 640): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    const sourceW = "videoWidth" in src ? src.videoWidth : src.naturalWidth;
    const sourceH = "videoHeight" in src ? src.videoHeight : src.naturalHeight;
    if (!sourceW || !sourceH) return null;
    const ratio = Math.min(size / sourceW, size / sourceH);
    canvas.width = Math.max(1, Math.round(sourceW * ratio));
    canvas.height = Math.max(1, Math.round(sourceH * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9));
  } catch {
    return null;
  }
}

function imgToDataUrl(img: HTMLImageElement) {
  try {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 96;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(img, 0, 0, 96, 96);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

export function AddCameraModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (f: Omit<Feed, "id" | "createdAt">) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Feed["kind"]>("local");
  const [url, setUrl] = useState("front");
  const [desc, setDesc] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const onTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (kind === "local") {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach((t) => t.stop());
        setTestResult("OK — local camera available");
      } else if (kind === "hls" || kind === "mjpeg") {
        const r = await fetch(url, { method: "GET", mode: "no-cors" });
        setTestResult(r.type === "opaque" || r.ok ? "OK — stream reachable" : "Stream not reachable");
      } else {
        setTestResult("Webcam pairing handled at runtime");
      }
    } catch (e) {
      setTestResult(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    setTesting(false);
  };

  const onSave = () => {
    if (!name.trim()) return;
    if (kind !== "local" && !url.trim()) return;
    onAdd({ name: name.trim(), kind, url: url.trim(), description: desc });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-display text-xl tracking-[0.15em]">Add Camera</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Camera name (e.g. Front Door)"
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => {
              const k = e.target.value as Feed["kind"];
              setKind(k);
              setUrl(k === "local" ? "front" : "");
            }}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
          >
            <option value="local">Local Camera (this device)</option>
            <option value="hls">HLS Stream (.m3u8)</option>
            <option value="mjpeg">MJPEG / HTTP Image Stream</option>
          </select>

          {kind === "local" ? (
            <select
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
            >
              <option value="front">Front camera</option>
              <option value="back">Back camera</option>
            </select>
          ) : (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                kind === "hls"
                  ? "https://example.com/stream.m3u8"
                  : "http://192.168.1.100:8080/video"
              }
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
            />
          )}

          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
          />

          {kind !== "local" && (
            <p className="text-[10px] text-muted-foreground">
              Browsers can't decode RTSP directly. For RTSP cameras, run a gateway
              like MediaMTX and paste the HLS (.m3u8) URL above. Streams must allow
              cross-origin (CORS) requests.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onTest}
              disabled={testing}
              className="glow-hover flex-1 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs uppercase tracking-[0.25em] disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              onClick={onSave}
              className="glow-hover flex-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.25em] text-primary-foreground"
            >
              Save
            </button>
          </div>

          {testResult && (
            <p className="text-[11px] text-muted-foreground">{testResult}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddCameraButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glow-hover flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 text-muted-foreground hover:text-foreground"
    >
      <Plus className="h-5 w-5" />
      <span className="text-xs uppercase tracking-[0.3em]">Add Camera</span>
    </button>
  );
}
