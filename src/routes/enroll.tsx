import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { CameraFrame } from "@/components/camera-frame";
import { ModelGate } from "@/components/model-gate";
import { useCamera } from "@/hooks/use-camera";
import { loadFaceApi } from "@/lib/face-api-loader";
import {
  addIdentity,
  loadIdentities,
  removeIdentity,
  type Identity,
} from "@/lib/face-store";

export const Route = createFileRoute("/enroll")({
  head: () => ({
    meta: [
      { title: "Enroll · LENS" },
      {
        name: "description",
        content: "Capture and enroll a new face identity into LENS, stored privately on your device.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <EnrollPage />
    </ModelGate>
  ),
});

function EnrollPage() {
  const { videoRef, ready, error } = useCamera({ facingMode: "user" });
  const [faceDetected, setFaceDetected] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const lastDescriptor = useRef<Float32Array | null>(null);

  useEffect(() => setIdentities(loadIdentities()), []);

  // Live preview loop: detect a single face for UI feedback + cache descriptor for save.
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let alive = true;
    (async () => {
      const faceapi = await loadFaceApi();
      const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const tick = async () => {
        if (!alive || !videoRef.current) return;
        try {
          const result = await faceapi
            .detectSingleFace(videoRef.current, opts)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (result) {
            setFaceDetected(true);
            lastDescriptor.current = result.descriptor;
          } else {
            setFaceDetected(false);
            lastDescriptor.current = null;
          }
        } catch {
          // ignore frame errors
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [ready, videoRef]);

  const onSave = async () => {
    if (!name.trim()) {
      toast.error("Enter a name first");
      return;
    }
    if (!lastDescriptor.current) {
      toast.error("No face detected — center yourself in the frame");
      return;
    }
    setSaving(true);
    const id = addIdentity(name.trim(), lastDescriptor.current);
    setIdentities((prev) => [...prev, id]);
    toast.success(`Identity saved: ${id.name}`);
    setName("");
    setSaving(false);
  };

  const onDelete = (id: string) => {
    removeIdentity(id);
    setIdentities(loadIdentities());
    toast("Identity removed");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <LensNav />
      <main className="mx-auto max-w-3xl px-4 pt-28">
        <header className="animate-fade-in mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Step 01
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.15em]">Enroll Identity</h1>
        </header>

        <CameraFrame
          active={faceDetected}
          className="animate-fade-in aspect-[4/3] w-full sm:aspect-video"
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover [transform:scaleX(-1)]"
          />
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Requesting camera...
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs uppercase tracking-[0.25em] text-destructive">
              {error}
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
            {faceDetected ? (
              <span className="text-primary">Face detected</span>
            ) : (
              <span className="text-muted-foreground">Searching...</span>
            )}
          </div>
        </CameraFrame>

        {/* Save panel */}
        <div className="animate-fade-in glass mt-5 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subject name"
              className="flex-1 rounded-lg border border-border bg-input/40 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
            />
            <button
              onClick={onSave}
              disabled={saving}
              className="glow-hover inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Save Identity
            </button>
          </div>
        </div>

        {/* Enrolled list */}
        <section className="mt-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Enrolled · {identities.length}
          </p>
          {identities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No identities yet. Save your first above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {identities.map((i) => (
                <li
                  key={i.id}
                  className="glow-hover flex items-center justify-between rounded-xl border border-border bg-card/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-display text-base text-primary">
                      {i.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm">{i.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {new Date(i.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(i.id)}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${i.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
