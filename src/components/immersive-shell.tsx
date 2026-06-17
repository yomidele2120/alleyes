import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  back?: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  bottom?: ReactNode;
};

/**
 * Full-viewport immersive shell for camera flows.
 * - Pure black backdrop, slim top bar with back arrow + title.
 * - `children` is the camera stage (fills the available area).
 * - `bottom` is the action dock (fixed at bottom with safe-area padding).
 */
export function ImmersiveShell({
  title,
  subtitle,
  back = "/",
  onBack,
  right,
  children,
  bottom,
}: Props) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black text-foreground">
      {/* Top bar */}
      <header
        className="relative z-10 flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)",
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {onBack ? (
            <button
              onClick={onBack}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-foreground backdrop-blur transition-colors hover:bg-white/20"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to={back}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-foreground backdrop-blur transition-colors hover:bg-white/20"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-base tracking-[0.25em]">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </header>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden">{children}</div>

      {/* Bottom dock */}
      {bottom && (
        <div
          className="relative z-10 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]"
          style={{
            background:
              "linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.0) 100%)",
          }}
        >
          {bottom}
        </div>
      )}
    </div>
  );
}

/**
 * Camera stage: full-bleed video/canvas with corner brackets and
 * an absolutely-positioned overlay slot for bounding boxes.
 *
 * The canvas keeps its intrinsic video aspect and is cropped to fill
 * the viewport via `object-fit: cover` — no horizontal stretching.
 */
export function CameraStage({
  videoRef,
  canvasRef,
  mirror,
  night,
  active = true,
  gold,
  overlay,
  topPill,
  bottomPill,
  error,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  mirror?: boolean;
  night?: boolean;
  active?: boolean;
  gold?: boolean;
  overlay?: ReactNode;
  topPill?: ReactNode;
  bottomPill?: ReactNode;
  error?: string | null;
}) {
  const accent = gold ? "#C9A84C" : night ? "#00FF88" : "var(--primary)";
  return (
    <div className="absolute inset-0 bg-black">
      {/* Visible feed — native video preserves intrinsic aspect via object-cover,
          stays at full camera framerate, and is never stretched. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: "cover",
          transform: mirror ? "scaleX(-1)" : undefined,
          filter: night ? "brightness(1.35) contrast(1.25) saturate(0.85)" : undefined,
        }}
      />
      {/* Hidden detection canvas — face-api reads from this off-screen buffer. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      {night && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,255,136,0.06), rgba(0,255,136,0.14) 80%)", mixBlendMode: "screen" }}
        />
      )}


      {/* Corner brackets */}
      {(
        [
          "top-4 left-4 border-t-2 border-l-2 rounded-tl-lg",
          "top-4 right-4 border-t-2 border-r-2 rounded-tr-lg",
          "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-lg",
          "bottom-4 right-4 border-b-2 border-r-2 rounded-br-lg",
        ] as const
      ).map((pos, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute h-7 w-7 transition-colors ${pos}`}
          style={{ borderColor: accent, opacity: 0.9 }}
        />
      ))}

      {/* Scan line */}
      {active && !gold && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-visible">
          <div
            className="animate-scan-line h-px w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 12px 2px ${accent}`,
            }}
          />
        </div>
      )}

      {/* Top pill */}
      {topPill && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2">
          {topPill}
        </div>
      )}

      {/* Bottom pill */}
      {bottomPill && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2">
          {bottomPill}
        </div>
      )}

      {/* Bounding boxes overlay — sized to the stage exactly */}
      {overlay && (
        <div className="pointer-events-none absolute inset-0">{overlay}</div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-xs uppercase tracking-[0.25em] text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
