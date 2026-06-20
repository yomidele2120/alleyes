import { useEffect, useState } from "react";
import { loadFaceApi, loadExtras } from "@/lib/face-api-loader";
import { loadSettings } from "@/lib/settings-store";
import { backendConnection } from "@/lib/lens-backend";

export function ModelGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState("Booting...");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const steps = [
      "Loading runtime...",
      "Loading detector...",
      "Loading landmarks...",
      "Loading recognition...",
      "LENS Ready",
    ];
    loadFaceApi((m) => {
      const i = steps.indexOf(m);
      if (i >= 0) setProgress(((i + 1) / steps.length) * 100);
      setMsg(m);
    })
      .then(async () => {
        const s = loadSettings();
        if (s.showAge || s.showEmotion || s.showGender) {
          setMsg("Loading intelligence...");
          try { await loadExtras(); } catch { /* non-fatal */ }
        }
        backendConnection.setLocalReady(true);
        setReady(true);
      })
      .catch((e) => {
        backendConnection.setLocalReady(false);
        setErr(e instanceof Error ? e.message : "Failed to initialize");
      });
  }, []);

  if (err) {
    return (
      <div className="glass mx-auto mt-24 max-w-md rounded-2xl p-8 text-center">
        <p className="text-sm uppercase tracking-[0.25em] text-destructive">
          Initialization failed
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{err}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="glass animate-fade-in mx-auto mt-24 max-w-md rounded-2xl p-8 text-center">
        <p className="font-display text-2xl tracking-[0.3em]">LENS</p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Initializing...
        </p>
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-gold transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {msg}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
