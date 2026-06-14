import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LensNav } from "@/components/lens-nav";
import { ModelGate } from "@/components/model-gate";
import {
  AddCameraButton,
  AddCameraModal,
  NetworkTile,
} from "@/components/network-tile";
import {
  addFeed,
  removeFeed,
  useFeeds,
  type Feed,
} from "@/lib/feed-store";
import { loadIdentities, type Identity } from "@/lib/face-store";

export const Route = createFileRoute("/network")({
  head: () => ({
    meta: [
      { title: "Network · LENS" },
      {
        name: "description",
        content:
          "Command-center grid: connect up to 6 camera feeds and run face recognition on all of them at once.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <NetworkPage />
    </ModelGate>
  ),
});

function NetworkPage() {
  const feeds = useFeeds();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [adding, setAdding] = useState(false);
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setIdentities(loadIdentities());
    sync();
    window.addEventListener("lens:identities", sync);
    return () => window.removeEventListener("lens:identities", sync);
  }, []);

  // Grid columns based on tile count.
  const gridCols = useMemo(() => {
    const n = feeds.length + 1; // +1 add tile
    if (n <= 1) return "grid-cols-1";
    if (n === 2) return "grid-cols-1 sm:grid-cols-2";
    if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
    return "grid-cols-2 sm:grid-cols-3";
  }, [feeds.length]);

  const onAdd = (f: Omit<Feed, "id" | "createdAt">) => {
    try {
      addFeed(f);
      toast.success("Camera added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    }
  };

  const onTargetFound = (identityId: string, feedName: string) => {
    const name = identities.find((i) => i.id === identityId)?.name ?? "Target";
    setAlert(`Target Found — ${name} on ${feedName}`);
    setTimeout(() => setAlert(null), 4000);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-6xl px-4 pt-24">
        <header className="animate-fade-in mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              CCTV Grid
            </p>
            <h1 className="mt-1 font-display text-4xl tracking-[0.15em]">Network</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Search across network
            </span>
            <select
              multiple
              value={Array.from(targetIds)}
              onChange={(e) => {
                const next = new Set<string>();
                for (const o of Array.from(e.target.selectedOptions)) next.add(o.value);
                setTargetIds(next);
              }}
              className="max-h-10 rounded-md border border-border bg-input/40 px-2 py-1 text-xs"
            >
              {identities.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {targetIds.size > 0 && (
              <button
                onClick={() => setTargetIds(new Set())}
                className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
        </header>

        {alert && (
          <div className="animate-gold-pulse mb-3 rounded-xl px-4 py-3 text-center text-sm font-semibold uppercase tracking-[0.25em] text-background"
               style={{ background: "var(--gold)" }}>
            {alert}
          </div>
        )}

        <div className={`grid gap-3 ${gridCols}`}>
          {feeds.map((f) => (
            <NetworkTile
              key={f.id}
              feed={f}
              identities={identities}
              targetIds={targetIds}
              onRemove={() => removeFeed(f.id)}
              onTargetFound={onTargetFound}
            />
          ))}
          {feeds.length < 6 && <AddCameraButton onClick={() => setAdding(true)} />}
        </div>

        {feeds.length === 0 && (
          <p className="mt-6 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Add a local camera or HLS stream to begin
          </p>
        )}
      </main>

      {adding && <AddCameraModal onClose={() => setAdding(false)} onAdd={onAdd} />}
    </div>
  );
}
