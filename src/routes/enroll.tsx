import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { ModelGate } from "@/components/model-gate";
import { CameraGate } from "@/components/camera-gate";
import { useCamera } from "@/hooks/use-camera";
import { useNightMode } from "@/hooks/use-night-mode";
import { loadFaceApi } from "@/lib/face-api-loader";
import {
  addIdentity,
  loadIdentities,
  removeIdentity,
  saveIdentities,
  updateIdentity,
  type Identity,
} from "@/lib/face-store";
import { snapshotVideo } from "@/lib/utils-misc";
import { NightActivePill, NightModeToggle } from "@/components/night-mode-toggle";
import { ImmersiveShell, CameraStage } from "@/components/immersive-shell";
import { backendEnrollAngles, backendEnrollIdentity } from "@/lib/lens-backend";
import { useBackendHealth } from "@/hooks/use-backend-health";

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
  { key: "front-1", prompt: "Look straight at the camera" },
  { key: "front-2", prompt: "Hold steady — second straight shot" },
  { key: "left-1", prompt: "Turn slightly left" },
  { key: "left-2", prompt: "Hold left — second shot" },
  { key: "right-1", prompt: "Turn slightly right" },
  { key: "right-2", prompt: "Hold right — second shot" },
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

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return await response.blob();
}

function EnrollPage() {
  const { videoRef, ready, error } = useCamera({ facingMode: "user" });
  const { canvasRef, mode, cycleMode, lightLevel, active: nightActive } =
    useNightMode(videoRef);
  const { status: backendStatus } = useBackendHealth();
  const [name, setName] = useState("");
  const [step, setStep] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [locked, setLocked] = useState(false);
  const [showList, setShowList] = useState(false);

  const capturedDescriptors = useRef<Float32Array[]>([]);
  const capturedThumbs = useRef<string[]>([]);
  const lastDescriptor = useRef<Float32Array | null>(null);

  useEffect(() => setIdentities(loadIdentities()), []);
  useEffect(() => {
    if (step < STEPS.length) speak(STEPS[step].prompt);
  }, [step]);

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
    if (next >= STEPS.length) setLocked(true);
    else setStep(next);
  };

  const syncBackendEnrollment = async () => {
    const firstThumb = capturedThumbs.current[0];
    if (!firstThumb) return;
    const firstBlob = await dataUrlToBlob(firstThumb);
    if (!firstBlob) return;

    const backendIdentity = await backendEnrollIdentity({
      fullName: name.trim(),
      nin: "",
      idType: "",
      groupTag: "",
      notes: "",
      image: firstBlob,
    });

    for (const thumb of capturedThumbs.current.slice(1)) {
      const blob = await dataUrlToBlob(thumb);
      if (blob) {
        await backendEnrollAngles(backendIdentity.id, blob).catch(() => {});
      }
    }
  };

  const finish = async () => {
    if (!name.trim()) {
      toast.error("Enter a name first");
      return;
    }
    // Duplicate-face check: if any enrolled identity matches the first
    // captured descriptor above 70%, ask the user before creating a new one.
    const existing = loadIdentities();
    if (existing.length && capturedDescriptors.current.length) {
      try {
        const faceapi = await loadFaceApi();
        const labeled = existing.map(
          (i) =>
            new faceapi.LabeledFaceDescriptors(
              i.id,
              i.descriptors.map((d) => new Float32Array(d)),
            ),
        );
        const matcher = new faceapi.FaceMatcher(labeled, 0.42);
        const best = matcher.findBestMatch(capturedDescriptors.current[0]);
        const conf = 1 - best.distance;
        if (best.label !== "unknown" && conf >= 0.7) {
          const match = existing.find((i) => i.id === best.label);
          const ok = confirm(
            `This face looks like ${match?.name ?? "an existing identity"} (${Math.round(conf * 100)}%).\n\nOK = add these angles to ${match?.name}\nCancel = create a separate identity.`,
          );
          if (ok && match) {
            const merged = [
              ...match.descriptors.map((d) => new Float32Array(d)),
              ...capturedDescriptors.current,
            ];
            const mergedThumbs = [...match.thumbnails, ...capturedThumbs.current];
            updateIdentity(match.id, {
              descriptors: merged.map((d) => Array.from(d)),
              thumbnails: mergedThumbs,
            });
            toast.success(`Added ${capturedDescriptors.current.length} angles to ${match.name}`);
            resetCapture();
            setIdentities(loadIdentities());
            return;
          }
        }
      } catch { /* fall through to normal save */ }
    }
    const id = addIdentity(name.trim(), capturedDescriptors.current, capturedThumbs.current);
    toast.success(`Identity Locked: ${id.name}`);
    setIdentities(loadIdentities());
    if (backendStatus === "insightface") {
      void syncBackendEnrollment().catch(() => {
        toast.message("Saved locally. Backend sync failed, so the identity will stay in the app cache.");
      });
    }
    resetCapture();
  };

  const resetCapture = () => {
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
    <ImmersiveShell
      title="ENROLL"
      subtitle={locked ? `${STEPS.length} / ${STEPS.length} captured` : `${step}/${STEPS.length} · ${STEPS[step].prompt}`}
      right={
        <>
          <NightModeToggle mode={mode} onCycle={cycleMode} lightLevel={lightLevel} />
          <button
            onClick={() => setShowList((s) => !s)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-foreground backdrop-blur transition-colors hover:bg-white/20"
          >
            {identities.length} Saved
          </button>
        </>
      }
      bottom={
        <div className="glass rounded-2xl p-3">
          {/* Progress */}
          <div className="mb-3 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < (locked ? STEPS.length : step)
                    ? "bg-primary"
                    : i === step && !locked
                    ? "bg-primary/40"
                    : "bg-white/15"
                }`}
              />
            ))}
          </div>
          {!locked ? (
            <button
              onClick={captureStep}
              disabled={!faceDetected}
              className="glow-hover w-full rounded-lg bg-primary px-5 py-3 text-sm font-medium uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-40"
            >
              Capture {step + 1} of {STEPS.length}
            </button>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Subject name"
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={finish}
                className="glow-hover inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                <Check className="h-4 w-4" /> Save Identity
              </button>
            </div>
          )}
        </div>
      }
    >
      <CameraStage
        videoRef={videoRef}
        canvasRef={canvasRef}
        mirror
        night={nightActive && !locked}
        gold={locked}
        active={faceDetected && !locked}
        error={error}
        topPill={nightActive ? <NightActivePill /> : undefined}
        bottomPill={
          <div className="rounded-full border border-white/15 bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.3em] backdrop-blur">
            {faceDetected ? (
              <span style={nightActive ? { color: "#00FF88" } : undefined} className={nightActive ? "" : "text-primary"}>
                Face detected
              </span>
            ) : (
              <span className="text-muted-foreground">Searching…</span>
            )}
          </div>
        }
        overlay={
          locked ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div
                className="rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-background animate-gold-pulse"
                style={{ background: "var(--gold)" }}
              >
                Identity Locked
              </div>
            </div>
          ) : null
        }
      />

      {showList && (
        <div
          className="absolute inset-0 z-20 overflow-y-auto bg-black/85 px-4 pb-6 pt-4 backdrop-blur"
          onClick={() => setShowList(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Enrolled · {identities.length}
            </p>
            {identities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
                No identities yet.
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {identities.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {i.thumbnails[0] ? (
                        <img
                          src={i.thumbnails[0]}
                          alt={i.name}
                          className="h-10 w-10 shrink-0 rounded-full border border-white/15 object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 font-display text-base text-primary">
                          {i.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm">{i.name}</p>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          {i.descriptors.length} angle{i.descriptors.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onDelete(i.id)}
                      className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${i.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </ImmersiveShell>
  );
}
