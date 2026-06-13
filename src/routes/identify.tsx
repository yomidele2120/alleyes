import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { CameraFrame } from "@/components/camera-frame";
import { ModelGate } from "@/components/model-gate";
import { useCamera } from "@/hooks/use-camera";
import { useFaceRecognition, type Match } from "@/hooks/use-face-recognition";
import { loadIdentities, type Identity } from "@/lib/face-store";
import { BoundingBox } from "@/components/bounding-box";

export const Route = createFileRoute("/identify")({
  head: () => ({
    meta: [
      { title: "Identify · LENS" },
      {
        name: "description",
        content: "Live multi-face identification against your enrolled identities, fully on-device.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <IdentifyPage />
    </ModelGate>
  ),
});

function IdentifyPage() {
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const { videoRef, ready, error } = useCamera({ facingMode: facing });
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => setIdentities(loadIdentities()), []);

  useFaceRecognition(videoRef, identities, ready, (m, d) => {
    setMatches(m);
    setDim(d);
  });

  return (
    <div className="min-h-screen bg-background pb-10">
      <LensNav />
      <main className="mx-auto max-w-4xl px-4 pt-28">
        <div className="animate-fade-in mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Live recognition
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-[0.18em]">Identify</h1>
          </div>
          <div className="flex items-center gap-2">
            <Stat label="Faces" value={matches.length} />
            <Stat label="Enrolled" value={identities.length} accent />
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              className="glow-hover ml-1 rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:text-foreground sm:hidden"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CameraFrame active className="animate-fade-in aspect-[4/3] w-full sm:aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {/* Overlay layer matched to video display size */}
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0"
            style={{ width: dim.w || "100%", height: dim.h || "100%" }}
          >
            {matches.map((m, i) => (
              <BoundingBox key={i} m={m} />
            ))}
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs uppercase tracking-[0.25em] text-destructive">
              {error}
            </div>
          )}
        </CameraFrame>

        {identities.length === 0 && (
          <p className="mt-5 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
            No enrolled identities — every face will read as UNIDENTIFIED
          </p>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass flex items-center gap-2 rounded-lg px-3 py-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${accent ? "bg-gold" : "bg-primary"} shadow-[0_0_8px]`}
        style={{ boxShadow: `0 0 8px var(--${accent ? "gold" : "primary"})` }}
      />
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-sm tabular-nums">{value}</span>
    </div>
  );
}

function BoundingBox({ m, gold, dim }: { m: Match; gold?: boolean; dim?: boolean }) {
  const known = m.identityId !== null;
  const color = gold ? "var(--gold)" : known ? "var(--primary)" : "color-mix(in oklab, var(--muted-foreground) 80%, transparent)";
  const opacity = dim ? 0.35 : 1;
  return (
    <div
      className={`absolute rounded-lg border-2 transition-all ${gold ? "animate-gold-pulse" : ""}`}
      style={{
        left: m.box.x,
        top: m.box.y,
        width: m.box.width,
        height: m.box.height,
        borderColor: color,
        opacity,
        boxShadow: gold
          ? "0 0 20px color-mix(in oklab, var(--gold) 60%, transparent)"
          : known
          ? "0 0 14px color-mix(in oklab, var(--primary) 35%, transparent)"
          : "none",
      }}
    >
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{
          background: gold
            ? "color-mix(in oklab, var(--gold) 85%, black)"
            : known
            ? "var(--primary)"
            : "color-mix(in oklab, var(--muted-foreground) 70%, black)",
          color: gold || known ? "var(--background)" : "var(--foreground)",
        }}
      >
        {m.label}
        {known && (
          <span className="ml-1 opacity-80">{Math.round(m.confidence * 100)}%</span>
        )}
      </div>
    </div>
  );
}

export { BoundingBox };
