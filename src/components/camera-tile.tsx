import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Maximize2, RadioTower, WifiOff } from "lucide-react";

type Props = {
  name: string;
  location?: string | null;
  hlsUrl: string;
  active?: boolean;
};

export function CameraTile({ name, location, hlsUrl, active = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !active) return;
    let hls: Hls | null = null;
    const onPlaying = () => setLive(true);
    const onErr = () => setLive(false);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onErr);

    if (Hls.isSupported()) {
      hls = new Hls({ liveSyncDurationCount: 3, lowLatencyMode: true });
      hls.loadSource(hlsUrl);
      hls.attachMedia(v);
      hls.on(Hls.Events.ERROR, () => setLive(false));
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = hlsUrl;
    }
    v.muted = true;
    v.play().catch(() => {});
    return () => {
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onErr);
      hls?.destroy();
    };
  }, [hlsUrl, active]);

  async function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await el.requestFullscreen();
  }

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2">
        <span className="rounded-md bg-black/55 px-2 py-1 text-[11px] tracking-wide text-foreground backdrop-blur">
          {name}
          {location ? <span className="ml-1 text-muted-foreground">· {location}</span> : null}
        </span>
        <span className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[10px] uppercase tracking-[0.2em] backdrop-blur">
          {live ? (
            <>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-emerald-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-red-400" />
              <span className="text-red-400">Offline</span>
            </>
          )}
        </span>
      </div>
      <button
        onClick={toggleFullscreen}
        className="absolute bottom-2 right-2 rounded-md bg-black/55 p-1.5 text-foreground/80 opacity-0 backdrop-blur transition group-hover:opacity-100"
        aria-label="Fullscreen"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      {!live && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <RadioTower className="h-6 w-6 animate-pulse" />
            <p className="text-[10px] uppercase tracking-[0.25em]">Awaiting stream</p>
          </div>
        </div>
      )}
    </div>
  );
}
