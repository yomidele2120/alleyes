import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crosshair, SwitchCamera } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { CameraFrame } from "@/components/camera-frame";
import { ModelGate } from "@/components/model-gate";
import { BoundingBox } from "@/components/bounding-box";
import { useCamera } from "@/hooks/use-camera";
import { useFaceRecognition, type Match } from "@/hooks/use-face-recognition";
import { loadIdentities, type Identity } from "@/lib/face-store";

export const Route = createFileRoute("/find")({
  head: () => ({
    meta: [
      { title: "Find · LENS" },
      {
        name: "description",
        content: "Search a crowd for a specific enrolled identity. Their face glows gold when located.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <FindPage />
    </ModelGate>
  ),
});

function FindPage() {
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const { videoRef, ready, error } = useCamera({ facingMode: facing });
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [targetId, setTargetId] = useState<string>("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [dim, setDim] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const list = loadIdentities();
    setIdentities(list);
    if (list[0]) setTargetId(list[0].id);
  }, []);

  useFaceRecognition(videoRef, identities, ready && !!targetId, (m, d) => {
    setMatches(m);
    setDim(d);
  });

  const target = identities.find((i) => i.id === targetId);
  const located = matches.find((m) => m.identityId === targetId);

  return (
    <div className="min-h-screen bg-background pb-10">
      <LensNav />
      <main className="mx-auto max-w-4xl px-4 pt-28">
        <header className="animate-fade-in mb-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Crowd search
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-[0.18em]">Find Mode</h1>
          </div>
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="glow-hover rounded-lg border border-border bg-card/60 p-2 text-muted-foreground hover:text-foreground sm:hidden"
            aria-label="Flip camera"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
        </header>

        {identities.length === 0 ? (
          <div className="glass animate-fade-in rounded-2xl p-8 text-center">
            <Crosshair className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
            <p className="mt-4 text-sm text-muted-foreground">
              No identities enrolled yet. Enroll a face to use Find Mode.
            </p>
            <Link
              to="/enroll"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Enroll a Face
            </Link>
          </div>
        ) : (
          <>
            <div className="animate-fade-in glass mb-4 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center">
              <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:px-2">
                Target
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                {identities.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>

            <CameraFrame
              active={!located}
              gold={!!located}
              className="animate-fade-in relative aspect-[4/3] w-full sm:aspect-video"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ width: dim.w || "100%", height: dim.h || "100%" }}
              >
                {matches.map((m, i) => {
                  const isTarget = m.identityId === targetId;
                  return (
                    <BoundingBox key={i} m={m} gold={isTarget} dim={!isTarget && !!located} />
                  );
                })}
              </div>

              {/* Status banner */}
              <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2">
                {located ? (
                  <div className="rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-background animate-gold-pulse"
                       style={{ background: "var(--gold)" }}>
                    Target Located — {target?.name}
                  </div>
                ) : (
                  <div className="glass flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    Scanning... {target ? `for ${target.name}` : ""}
                  </div>
                )}
              </div>

              {error && (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs uppercase tracking-[0.25em] text-destructive">
                  {error}
                </div>
              )}
            </CameraFrame>
          </>
        )}
      </main>
    </div>
  );
}
