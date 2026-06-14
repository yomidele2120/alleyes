import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { CameraFrame } from "@/components/camera-frame";
import { ModelGate } from "@/components/model-gate";
import { CameraGate } from "@/components/camera-gate";
import { useCamera } from "@/hooks/use-camera";
import { useFaceRecognition, type Match } from "@/hooks/use-face-recognition";
import { loadIdentities, type Identity } from "@/lib/face-store";
import { BoundingBox } from "@/components/bounding-box";
import { FaceIntelPanel } from "@/components/face-intel-panel";

export const Route = createFileRoute("/identify")({
  head: () => ({
    meta: [
      { title: "Identify · LENS" },
      {
        name: "description",
        content:
          "Live multi-face identification against your enrolled identities, fully on-device.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <CameraGate>
        <IdentifyPage />
      </CameraGate>
    </ModelGate>
  ),
});

function IdentifyPage() {
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const { videoRef, ready, error } = useCamera({ facingMode: facing });
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [dim, setDim] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<{ id: string; match: Match } | null>(null);

  useEffect(() => {
    const sync = () => setIdentities(loadIdentities());
    sync();
    window.addEventListener("lens:identities", sync);
    return () => window.removeEventListener("lens:identities", sync);
  }, []);

  useFaceRecognition(
    videoRef,
    identities,
    ready,
    (m, d) => {
      setMatches(m);
      setDim(d);
    },
    { feedName: "Local Camera", withExtras: true },
  );

  const selectedIdentity = selected
    ? identities.find((i) => i.id === selected.id)
    : null;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-4xl px-4 pt-24">
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
          <div
            className="pointer-events-none absolute inset-0"
            style={{ width: dim.w || "100%", height: dim.h || "100%" }}
          >
            {matches.map((m, i) => (
              <BoundingBox
                key={i}
                m={m}
                onClick={
                  m.identityId
                    ? () => setSelected({ id: m.identityId!, match: m })
                    : undefined
                }
              />
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

      {selected && selectedIdentity && (
        <FaceIntelPanel
          identity={selectedIdentity}
          match={selected.match}
          feedName="Local Camera"
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="glass flex items-center gap-2 rounded-lg px-3 py-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: accent ? "var(--gold)" : "var(--primary)",
          boxShadow: `0 0 8px ${accent ? "var(--gold)" : "var(--primary)"}`,
        }}
      />
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      <span className="font-display text-sm tabular-nums">{value}</span>
    </div>
  );
}
