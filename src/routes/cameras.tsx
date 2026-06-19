import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Radio, ToggleRight, ToggleLeft } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { SignInGate } from "@/components/sign-in-gate";
import { useSession } from "@/hooks/use-session";
import {
  createCamera,
  deleteCamera,
  listCameras,
  slugify,
  updateCamera,
  type CloudCamera,
} from "@/lib/cloud/cameras";
import { hlsUrlFor, rtmpPushUrlFor } from "@/lib/lens-backend";

export const Route = createFileRoute("/cameras")({
  head: () => ({
    meta: [
      { title: "Cameras — LENS" },
      { name: "description", content: "Manage RTMP camera feeds for the LENS dashboard." },
    ],
  }),
  component: CamerasPage,
});

function CamerasPage() {
  const { user, loading } = useSession();
  const qc = useQueryClient();
  const camerasQuery = useQuery({ queryKey: ["cameras"], queryFn: listCameras, enabled: !!user });
  const [showAdd, setShowAdd] = useState(false);

  if (loading) return null;
  if (!user) return <SignInGate feature="Cameras" />;

  const cams = camerasQuery.data ?? [];

  return (
    <div className="relative min-h-screen mesh-bg pb-28 md:pb-10 pt-24">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <LensNav />
      <main className="relative mx-auto max-w-5xl px-5">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Hardware</p>
            <h1 className="font-display text-3xl tracking-[0.2em]">Cameras</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Add Camera
          </button>
        </header>

        {cams.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-xl tracking-[0.15em]">No cameras yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first camera to start ingesting RTMP streams.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {cams.map((c) => (
              <CameraRow
                key={c.id}
                cam={c}
                onChange={() => qc.invalidateQueries({ queryKey: ["cameras"] })}
              />
            ))}
          </ul>
        )}
      </main>

      {showAdd && (
        <AddCameraModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["cameras"] });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function CameraRow({ cam, onChange }: { cam: CloudCamera; onChange: () => void }) {
  const rtmp = rtmpPushUrlFor(cam.rtmp_key);
  const hls = cam.stream_url || hlsUrlFor(cam.rtmp_key);

  async function toggle() {
    await updateCamera(cam.id, { is_active: !cam.is_active });
    onChange();
  }
  async function remove() {
    if (!confirm(`Delete camera "${cam.name}"?`)) return;
    await deleteCamera(cam.id);
    toast.success("Camera removed");
    onChange();
  }
  function copy(s: string) {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  }

  return (
    <li className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{cam.name}</p>
          <p className="text-xs text-muted-foreground">{cam.location || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="text-muted-foreground transition hover:text-foreground"
            aria-label={cam.is_active ? "Disable" : "Enable"}
            title={cam.is_active ? "Disable" : "Enable"}
          >
            {cam.is_active ? (
              <ToggleRight className="h-5 w-5 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-5 w-5" />
            )}
          </button>
          <button
            onClick={remove}
            className="text-muted-foreground transition hover:text-red-400"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-xs">
        <UrlLine label="RTMP push" url={rtmp} onCopy={() => copy(rtmp)} />
        <UrlLine label="HLS view" url={hls} onCopy={() => copy(hls)} />
      </div>
    </li>
  );
}

function UrlLine({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-input/30 px-2.5 py-2">
      <span className="w-20 shrink-0 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90">
        {url}
      </code>
      <button onClick={onCopy} className="text-muted-foreground hover:text-foreground" aria-label="Copy">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddCameraModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const finalKey = key || slugify(name);

  async function submit() {
    if (!name) return toast.error("Name required");
    if (!finalKey) return toast.error("Stream key required");
    setBusy(true);
    try {
      await createCamera({ name, location, rtmp_key: finalKey });
      toast.success("Camera added");
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add camera");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="glass w-full max-w-md rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl tracking-[0.15em]">Add Camera</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Point any RTMP source at the push URL shown after saving.
        </p>
        <div className="mt-4 space-y-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front Gate"
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Building A, North entrance"
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="Stream key">
            <input
              value={finalKey}
              onChange={(e) => setKey(slugify(e.target.value))}
              placeholder="front_gate"
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
