import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { CameraFrame } from "@/components/camera-frame";
import { ModelGate } from "@/components/model-gate";
import { CameraGate } from "@/components/camera-gate";
import { useCamera } from "@/hooks/use-camera";
import { useNightMode } from "@/hooks/use-night-mode";
import { loadFaceApi } from "@/lib/face-api-loader";
import {
  addIdentity,
  loadIdentities,
  removeIdentity,
  type Identity,
} from "@/lib/face-store";
import { snapshotVideo } from "@/lib/utils-misc";
import { NightActivePill, NightModeToggle } from "@/components/night-mode-toggle";

export const Route = createFileRoute("/enroll")({
  head: () => ({
    meta: [
      { title: "Enroll · LENS" },
      {
        name: "description",
        content:
          "Capture five angles of a face to enroll a high-accuracy identity, stored privately on your device.",
      },
    ],
  }),
  component: () => (
    <ModelGate>
      <CameraGate>
        <EnrollPage />
      </CameraGate>
    </ModelGate>
  ),
});

const STEPS = [
  { key: "front", prompt: "Look straight at the camera" },
  { key: "left", prompt: "Turn slightly left" },
  { key: "right", prompt: "Turn slightly right" },
  { key: "up", prompt: "Tilt your head up" },
  { key: "down", prompt: "Tilt your head down" },
] as const;

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.volume = 0.7;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

function EnrollPage() {
  const { videoRef, ready, error } = useCamera({ facingMode: "user" });
  const { canvasRef, mode, cycleMode, lightLevel, active: nightActive } =
    useNightMode(videoRef);
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [locked, setLocked] = useState(false);

  const capturedDescriptors = useRef<Float32Array[]>([]);
  const capturedThumbs = useRef<string[]>([]);
  const lastDescriptor = useRef<Float32Array | null>(null);

  useEffect(() => setIdentities(loadIdentities()), []);
  useEffect(() => {
    if (step < STEPS.length) speak(STEPS[step].prompt);
  }, [step]);

  // Live detection runs against the enhanced canvas so dark enrollment works.
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    let alive = true;
    (async () => {
      const faceapi = await loadFaceApi();
      const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const tick = async () => {
        if (!alive) return;
        const src = canvasRef.current;
        if (src && src.width > 0) {
          try {
            const result = await faceapi
              .detectSingleFace(src, opts)
              .withFaceLandmarks()
              .withFaceDescriptor();
            if (result) {
              setFaceDetected(true);
              lastDescriptor.current = result.descriptor;
            } else {
              setFaceDetected(false);
              lastDescriptor.current = null;
            }
          } catch { /* ignore */ }
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [ready, canvasRef]);

  const captureStep = () => {
    if (!lastDescriptor.current || !videoRef.current) {
      toast.error("Hold still — no face detected");
      return;
    }
    capturedDescriptors.current.push(lastDescriptor.current);
    const src = canvasRef.current;
    if (src) {
      try {
        const c = document.createElement("canvas");
        c.width = 96;
        c.height = 96;
        c.getContext("2d")?.drawImage(src, 0, 0, 96, 96);
        capturedThumbs.current.push(c.toDataURL("image/jpeg", 0.7));
      } catch {
        capturedThumbs.current.push(videoRef.current ? snapshotVideo(videoRef.current, 96) : "");
      }
    } else if (videoRef.current) {
      capturedThumbs.current.push(snapshotVideo(videoRef.current, 96));
    }
    const next = step + 1;
    if (next >= STEPS.length) {
      setLocked(true);
    } else {
      setStep(next);
    }
  };

  const finish = () => {
    if (!name.trim()) {
      toast.error("Enter a name first");
      return;
    }
    const id = addIdentity(name.trim(), capturedDescriptors.current, capturedThumbs.current);
    toast.success(`Identity Locked: ${id.name}`);
    setIdentities(loadIdentities());
    setName("");
    setStep(0);
    setLocked(false);
    capturedDescriptors.current = [];
    capturedThumbs.current = [];
  };

  const onDelete = (id: string) => {
    removeIdentity(id);
    setIdentities(loadIdentities());
    toast("Identity removed");
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-3xl px-4 pt-24">
        <header className="animate-fade-in mb-6 text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Multi-angle capture
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.15em]">Enroll Identity</h1>
          <div className="mt-3 flex items-center justify-center">
            <NightModeToggle mode={mode} onCycle={cycleMode} lightLevel={lightLevel} />
          </div>
          {nightActive && (
            <p className="mt-3 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#00FF88" }}>
              Tip: For best results enroll the same person again in normal light, e.g. "{name || "Name"} (Day)" and "{name || "Name"} (Night)"
            </p>
          )}
        </header>

        {/* Progress bar */}
        <div className="mx-auto mb-3 flex max-w-md items-center gap-2">
          <header className="hidden">
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Multi-angle capture
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.15em]">Enroll Identity</h1>
          <div className="mt-3 flex items-center justify-center">
            <NightModeToggle mode={mode} onCycle={cycleMode} lightLevel={lightLevel} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Multi-angle capture
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-[0.15em]">Enroll Identity</h1>
          <div className="mt-3 flex items-center justify-center">
            <NightModeToggle mode={mode} onCycle={cycleMode} lightLevel={lightLevel} />
          </div>
          {nightActive && (
            <p className="mt-3 text-[10px] uppercase tracking-[0.25em]" style={{ color: "#00FF88" }}>
              Tip: For best results enroll the same person again in normal light, e.g. "{name || "Name"} (Day)" and "{name || "Name"} (Night)"
            </p>
          )}
        </header>

        {/* Progress bar */}
        <div className="mx-auto mb-3 flex max-w-md items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < (locked ? STEPS.length : step)
                  ? "bg-primary"
                  : i === step && !locked
                  ? "bg-primary/40"
                  : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="mb-4 text-center text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
          {locked ? "5 / 5 Captured" : `${step}/5 — ${STEPS[step].prompt}`}
        </p>

        <CameraFrame
          active={faceDetected && !locked}
          gold={locked}
          night={nightActive && !locked}
          className="animate-fade-in relative aspect-[4/3] w-full sm:aspect-video"
        >
          <video ref={videoRef} autoPlay playsInline muted className="hidden" />
          <canvas
            ref={canvasRef}
            className="h-full w-full object-cover [transform:scaleX(-1)]"
          />
          {nightActive && <NightActivePill />}
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
          {locked && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40">
              <div className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background animate-gold-pulse"
                   style={{ background: "var(--gold)" }}>
                Identity Locked
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border bg-background/70 px-3 py-1 text-[10px] uppercase tracking-[0.3em]">
            {faceDetected ? (
              <span style={nightActive ? { color: "#00FF88" } : undefined} className={nightActive ? "" : "text-primary"}>Face detected</span>
            ) : (
              <span className="text-muted-foreground">Searching...</span>
            )}
          </div>
        </CameraFrame>

        {/* Capture / Save controls */}
        <div className="animate-fade-in glass mt-5 rounded-2xl p-4 sm:p-5">
          {!locked ? (
            <button
              onClick={captureStep}
              disabled={!faceDetected}
              className="glow-hover w-full rounded-lg bg-primary px-5 py-3 text-sm font-medium uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-40"
            >
              Capture {step + 1} of 5
            </button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Subject name"
                className="flex-1 rounded-lg border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
              />
              <button
                onClick={finish}
                className="glow-hover inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                <Check className="h-4 w-4" />
                Save Identity
              </button>
            </div>
          )}
        </div>

        {/* Enrolled list */}
        <section className="mt-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Enrolled · {identities.length}
          </p>
          {identities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No identities yet. Capture all 5 angles above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {identities.map((i) => (
                <li
                  key={i.id}
                  className="glow-hover flex items-center justify-between rounded-xl border border-border bg-card/60 p-3"
                >
                  <div className="flex items-center gap-3">
                    {i.thumbnails[0] ? (
                      <img src={i.thumbnails[0]} alt={i.name}
                        className="h-10 w-10 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-display text-base text-primary">
                        {i.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm">{i.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        {i.descriptors.length} angle{i.descriptors.length === 1 ? "" : "s"}
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
