import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload, Trash2, Lock, Plug, CheckCircle2, XCircle } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import {
  hashPin,
  useSettings,
  type Settings,
} from "@/lib/settings-store";
import { loadIdentities, saveIdentities, type Identity } from "@/lib/face-store";
import { clearLog } from "@/lib/detection-log";
import { pingBackend } from "@/lib/lens-backend";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings · LENS" },
      {
        name: "description",
        content:
          "Tune LENS thresholds, intelligence overlays, alerts, and manage local data.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [s, update] = useSettings();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pin, setPin] = useState("");

  const onExport = () => {
    const data = JSON.stringify(loadIdentities(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lens-identities-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Identity[];
      if (!Array.isArray(parsed)) throw new Error("Invalid file");
      saveIdentities(parsed);
      toast.success(`Imported ${parsed.length} identities`);
    } catch {
      toast.error("Failed to import — invalid JSON");
    }
  };

  const onClearAll = () => {
    if (!confirm("Delete ALL identities and detection log? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    saveIdentities([]);
    clearLog();
    toast.success("All local data cleared");
  };

  const setPinLock = async (enable: boolean) => {
    if (enable) {
      if (!pin || pin.length < 4) {
        toast.error("Enter a PIN of at least 4 digits");
        return;
      }
      const hashed = await hashPin(pin);
      update({ pinLockEnabled: true, pinHash: hashed });
      setPin("");
      toast.success("PIN lock enabled");
    } else {
      update({ pinLockEnabled: false, pinHash: null });
      toast("PIN lock disabled");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-2xl px-4 pt-24">
        <header className="animate-fade-in mb-6">
          <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Configuration
          </p>
          <h1 className="mt-1 font-display text-4xl tracking-[0.15em]">Settings</h1>
        </header>

        <Section title="Recognition">
          <label className="block">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <span>Confidence Threshold</span>
              <span>{Math.round(s.confidenceThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.8}
              step={0.01}
              value={s.confidenceThreshold}
              onChange={(e) => update({ confidenceThreshold: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </label>
        </Section>

        <Section title="Intelligence Overlays">
          <Toggle label="Show estimated age" k="showAge" s={s} update={update} />
          <Toggle label="Show emotion detection" k="showEmotion" s={s} update={update} />
          <Toggle label="Show gender estimation" k="showGender" s={s} update={update} />
          <Toggle label="Show UNIDENTIFIED faces" k="showUnknown" s={s} update={update} />
        </Section>

        <Section title="Alerts">
          <Toggle label="Sound alert on target found" k="soundAlerts" s={s} update={update} />
          <Toggle label="Auto-snapshot on detection" k="autoSnapshot" s={s} update={update} />
        </Section>

        <Section title="Night Vision">
          <Toggle label="Auto Night Mode" k="autoNightMode" s={s} update={update} />
          <Toggle label="Green night-vision tint" k="greenTint" s={s} update={update} />
          <label className="block">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <span>Manual brightness boost</span>
              <span>+{s.manualBrightnessBoost}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={s.manualBrightnessBoost}
              onChange={(e) => update({ manualBrightnessBoost: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </label>
          <label className="block">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <span>Manual contrast boost</span>
              <span>×{s.manualContrastBoost.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={2.5}
              step={0.05}
              value={s.manualContrastBoost}
              onChange={(e) => update({ manualContrastBoost: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </label>
          <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5 text-xs text-muted-foreground">
            <p>
              Active mode:{" "}
              <span className="text-foreground">{s.nightModeOverride.toUpperCase()}</span>
            </p>
            <p className="mt-1">Toggle on any camera screen with the moon icon.</p>
          </div>
        </Section>

        <Section title="Data">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExport}
              className="glow-hover inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm"
            >
              <Download className="h-4 w-4" /> Export JSON
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="glow-hover inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm"
            >
              <Upload className="h-4 w-4" /> Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
            />
            <button
              onClick={onClearAll}
              className="glow-hover col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Clear All Data
            </button>
          </div>
        </Section>

        <Section title="Backend Servers">
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Python backend URL
            </span>
            <div className="flex gap-2">
              <input
                value={s.backendUrl}
                onChange={(e) => update({ backendUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
              />
              <TestButton onTest={async () => !!(await pingBackend())} />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              MediaMTX (HLS) URL
            </span>
            <input
              value={s.mediamtxUrl}
              onChange={(e) => update({ mediamtxUrl: e.target.value })}
              placeholder="http://localhost:8888"
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              WebSocket URL
            </span>
            <input
              value={s.wsUrl}
              onChange={(e) => update({ wsUrl: e.target.value })}
              placeholder="ws://localhost:3001"
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          </label>
          <div className="rounded-lg border border-border bg-card/40 px-3 py-2.5 text-xs text-muted-foreground">
            When the Python backend is unreachable, LENS falls back to the in-browser face-api.js
            engine so Identify and Enroll keep working.
          </div>
        </Section>

        <Section title="Recognition Precision">
          <label className="block">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <span>Similarity threshold</span>
              <span>{s.similarityThreshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.35}
              max={0.6}
              step={0.01}
              value={s.similarityThreshold}
              onChange={(e) => update({ similarityThreshold: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </label>
          <label className="block">
            <div className="mb-2 flex justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <span>Frame analysis rate</span>
              <span>{s.fpsRate} fps</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={s.fpsRate}
              onChange={(e) => update({ fpsRate: Number(e.target.value) })}
              className="w-full accent-[var(--primary)]"
            />
          </label>
          <Toggle label="Show age estimate" k="showAgeEstimate" s={s} update={update} />
          <Toggle label="Show gender estimate" k="showGenderEstimate" s={s} update={update} />
          <Toggle label="Sound on TARGET found" k="soundOnTarget" s={s} update={update} />
          <Toggle label="Sound on WATCHLIST" k="soundOnWatchlist" s={s} update={update} />
          <Toggle label="Desktop notifications" k="desktopNotifications" s={s} update={update} />
        </Section>


        <Section title="App PIN Lock">
          <p className="mb-3 text-xs text-muted-foreground">
            Local-only screen guard. Stored as SHA-256 hash on this device.
          </p>
          {!s.pinLockEnabled ? (
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="Enter PIN (4-8 digits)"
                className="flex-1 rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
              />
              <button
                onClick={() => setPinLock(true)}
                className="glow-hover inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Lock className="h-4 w-4" /> Enable
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPinLock(false)}
              className="glow-hover inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm"
            >
              Disable PIN Lock
            </button>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="animate-fade-in mb-6 glass rounded-2xl p-5">
      <p className="mb-4 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  k,
  s,
  update,
}: {
  label: string;
  k: keyof Settings;
  s: Settings;
  update: (p: Partial<Settings>) => void;
}) {
  const checked = !!s[k];
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card/40 px-3 py-2.5 text-sm">
      <span>{label}</span>
      <span
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-background transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        onChange={(e) => update({ [k]: e.target.checked } as Partial<Settings>)}
      />
    </label>
  );
}
