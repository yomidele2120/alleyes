import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SwitchCamera } from "lucide-react";
import { ModelGate } from "@/components/model-gate";
import { CameraGate } from "@/components/camera-gate";
import { useCamera } from "@/hooks/use-camera";
import { useFaceRecognition, type Match } from "@/hooks/use-face-recognition";
import { useNightMode } from "@/hooks/use-night-mode";
import { loadIdentities, type Identity } from "@/lib/face-store";
import { BoundingBox } from "@/components/bounding-box";
import { FaceIntelPanel } from "@/components/face-intel-panel";
import { NightActivePill, NightModeToggle } from "@/components/night-mode-toggle";
import { ImmersiveShell, CameraStage } from "@/components/immersive-shell";

export const Route = createFileRoute("/identify")({
  head: () => ({
    meta: [
      { title: "Identify · LENS" },
      {
        name: "description",
        content:
          "Live multi-face identification against your enrolled identities, fully on-device, day or night.",
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
  const { canvasRef, mode, cycleMode, lightLevel } = useNightMode(videoRef);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<{ id: string; match: Match } | null>(null);

  useEffect(() => {
    const sync = () => setIdentities(loadIdentities());
    sync();
    window.addEventListener("lens:identities", sync);
    return () => window.removeEventListener("lens:identities", sync);
  }, []);

  useFaceRecognition(
    canvasRef,
    identities,
    ready,
    (m) => setMatches(m),
    { feedName: "Local Camera", withExtras: true },
  );

  const selectedIdentity = selected
    ? identities.find((i) => i.id === selected.id)
    : null;

  const isNightActive = mode === "on";

  return (
    <>
      <ImmersiveShell
        title="IDENTIFY"
        subtitle={`${matches.length} face${matches.length === 1 ? "" : "s"} · ${identities.length} enrolled`}
        right={
          <>
            <NightModeToggle mode={mode} onCycle={cycleMode} lightLevel={lightLevel} />
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-foreground backdrop-blur transition-colors hover:bg-white/20"
              aria-label="Flip camera"
            >
              <SwitchCamera className="h-4 w-4" />
            </button>
          </>
        }
        bottom={
          identities.length === 0 ? (
            <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              No enrolled identities — every face reads as UNIDENTIFIED
            </p>
          ) : (
            <p className="text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Tap a labeled face to view full intel
            </p>
          )
        }
      >
        <CameraStage
          videoRef={videoRef}
          canvasRef={canvasRef}
          mirror={facing === "user"}
          night={isNightActive}
          active={ready}
          error={error}
          topPill={isNightActive ? <NightActivePill /> : undefined}
          overlay={
            <div className="pointer-events-auto absolute inset-0">
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
          }
        />
      </ImmersiveShell>

      {selected && selectedIdentity && (
        <FaceIntelPanel
          identity={selectedIdentity}
          match={selected.match}
          feedName="Local Camera"
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
