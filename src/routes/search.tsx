import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crosshair, Play, SwitchCamera } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { ModelGate } from "@/components/model-gate";
import { CameraGate } from "@/components/camera-gate";
import { BoundingBox } from "@/components/bounding-box";
import { useCamera } from "@/hooks/use-camera";
import { useFaceRecognition, type Match } from "@/hooks/use-face-recognition";
import { useNightMode } from "@/hooks/use-night-mode";
import { loadIdentities, type Identity } from "@/lib/face-store";
import { loadSettings } from "@/lib/settings-store";
import { chime, targetColor } from "@/lib/utils-misc";
import { NightActivePill, NightModeToggle } from "@/components/night-mode-toggle";
import { ImmersiveShell, CameraStage } from "@/components/immersive-shell";
import { backendClearTargets, backendSetTargets } from "@/lib/lens-backend";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search · LENS" },
      {
        name: "description",
        content:
          "Search a crowd for one or more enrolled identities. Targets pulse gold when located.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <CameraGate>
        <SearchPage />
      </CameraGate>
    </ModelGate>
  ),
});

function SearchPage() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const { videoRef, ready, error } = useCamera({ facingMode: facing });
  const { canvasRef, mode, cycleMode, lightLevel } = useNightMode(videoRef);
  const [matches, setMatches] = useState<Match[]>([]);
  const [everFound, setEverFound] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => setIdentities(loadIdentities()), []);

  useEffect(() => {
    if (!searching) return;
    return () => {
      void backendClearTargets().catch(() => {});
    };
  }, [searching]);

  useFaceRecognition(
    canvasRef,
    identities,
    ready && searching,
    (m) => {
      setMatches(m);
      const newFound = new Set(everFound);
      let changed = false;
      for (const match of m) {
        if (match.identityId && selected.has(match.identityId) && !newFound.has(match.identityId)) {
          newFound.add(match.identityId);
          changed = true;
        }
      }
      if (changed) {
        setEverFound(newFound);
        if (loadSettings().soundAlerts) chime();
      }
    },
    { feedName: "Search", withExtras: false },
  );

  const targets = useMemo(
    () => identities.filter((i) => selected.has(i.id)),
    [identities, selected],
  );

  const targetColorMap = useMemo(() => {
    const map = new Map<string, string>();
    targets.forEach((t, idx) => map.set(t.id, targetColor(idx)));
    return map;
  }, [targets]);

  const foundIds = useMemo(
    () => new Set(matches.map((m) => m.identityId).filter(Boolean) as string[]),
    [matches],
  );

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const beginSearch = async () => {
    if (selected.size === 0) return;
    try {
      await backendSetTargets(Array.from(selected));
    } catch {
      // backend target sync is best-effort; the local search flow still runs
    }
    setEverFound(new Set());
    setSearching(true);
  };

  if (!searching) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-10">
        <LensNav />
        <main className="mx-auto max-w-4xl px-4 pt-24">
          <header className="animate-fade-in mb-6">
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Target acquisition
            </p>
            <h1 className="mt-1 font-display text-4xl tracking-[0.15em]">Search</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Select one or more targets. Search runs full-screen against all faces in frame.
            </p>
          </header>

          {identities.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <Crosshair className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.4} />
              <p className="mt-4 text-sm text-muted-foreground">
                No identities enrolled yet.
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
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {identities.map((i, idx) => {
                  const active = selected.has(i.id);
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => toggle(i.id)}
                        className={`glow-hover flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card/60"
                        }`}
                      >
                        {i.thumbnails[0] ? (
                          <img
                            src={i.thumbnails[0]}
                            alt={i.name}
                            className="h-10 w-10 rounded-full border border-border object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full font-display text-base"
                            style={{
                              background: `${targetColor(idx)}22`,
                              color: targetColor(idx),
                            }}
                          >
                            {i.name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{i.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                            {new Date(i.firstEnrolled).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`h-4 w-4 rounded border ${
                            active ? "border-primary bg-primary" : "border-border"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={beginSearch}
                disabled={selected.size === 0}
                className="glow-hover mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-40"
              >
                <Play className="h-4 w-4" />
                Begin Search ({selected.size})
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  const single = targets.length === 1;
  const located = single && foundIds.has(targets[0].id);
  const foundCount = targets.filter((t) => foundIds.has(t.id)).length;
  const allFound = foundCount === targets.length && targets.length > 0;
  const isNight = mode === "on" && !located && !allFound;

  return (
    <ImmersiveShell
      title="SEARCH"
      subtitle={
        single
          ? located
            ? `Located — ${targets[0].name}`
            : `Scanning for ${targets[0].name}`
          : `${foundCount} / ${targets.length} located`
      }
      onBack={() => {
        setSearching(false);
        void backendClearTargets().catch(() => {});
        navigate({ to: "/search" });
      }}
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
        <div className="glass flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2">
          {targets.map((t) => {
            const found = foundIds.has(t.id);
            const c = targetColorMap.get(t.id)!;
            return (
              <span
                key={t.id}
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em]"
                style={{ background: `${c}22`, color: c }}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${found ? "" : "animate-pulse"}`}
                  style={{ background: c }}
                />
                {t.name} · {found ? "FOUND" : "…"}
              </span>
            );
          })}
        </div>
      }
    >
      <CameraStage
        videoRef={videoRef}
        canvasRef={canvasRef}
        night={isNight}
        gold={located || allFound}
        active={ready && !located && !allFound}
        error={error}
        topPill={mode === "on" ? <NightActivePill /> : undefined}
        overlay={
          <>
            {matches.map((m, i) => {
              const isTarget = m.identityId && selected.has(m.identityId);
              const color = isTarget ? targetColorMap.get(m.identityId!) : undefined;
              return (
                <BoundingBox
                  key={i}
                  m={m}
                  color={color}
                  target={!!isTarget && single}
                  dim={!isTarget}
                />
              );
            })}
          </>
        }
      />
    </ImmersiveShell>
  );
}
