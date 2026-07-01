import { Link } from "@tanstack/react-router";
import { X, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Identity } from "@/lib/face-store";
import type { Match } from "@/hooks/use-face-recognition";
import { emotionEmoji } from "@/lib/utils-misc";
import { recentSightings } from "@/lib/detection-log";
import { dojahVerifyNin, type DojahVerifyResult } from "@/lib/dojah.functions";

export function FaceIntelPanel({
  identity,
  match,
  feedName,
  onClose,
  getSnapshot,
}: {
  identity: Identity;
  match?: Match;
  feedName?: string;
  onClose: () => void;
  /** Optional live-frame capture (base64 dataURL) for Dojah selfie match. */
  getSnapshot?: () => string | null;
}) {
  const sightings = useMemo(() => recentSightings(identity.id, 8), [identity.id]);
  const [nin, setNin] = useState(identity.nin || "");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<DojahVerifyResult | null>(null);
  const verify = useServerFn(dojahVerifyNin);

  const runVerify = async () => {
    if (!/^\d{8,12}$/.test(nin)) {
      setResult({ ok: false, error: "Enter a valid NIN (8–12 digits). Sandbox: 12345678901" });
      return;
    }
    setVerifying(true);
    setResult(null);
    try {
      const selfie = getSnapshot?.() || identity.thumbnails[0] || null;
      const res = await verify({ data: { nin, selfieBase64: selfie || undefined } });
      setResult(res);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Verification failed" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm">
      <div className="glass animate-fade-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:mb-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {identity.thumbnails[0] ? (
              <img
                src={identity.thumbnails[0]}
                alt={identity.name}
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 font-display text-xl text-primary">
                {identity.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-2xl tracking-[0.1em]">{identity.name}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {identity.group || "Unassigned"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Detections" value={String(identity.detectionCount)} />
          <Stat
            label="Last Seen"
            value={
              identity.lastSeen
                ? new Date(identity.lastSeen).toLocaleString()
                : "Never"
            }
          />
          <Stat
            label="First Enrolled"
            value={new Date(identity.firstEnrolled).toLocaleDateString()}
          />
          <Stat label="Current Feed" value={feedName || "—"} />
          {match?.age != null && <Stat label="Est. Age" value={`~${Math.round(match.age)}`} />}
          {match?.expression && (
            <Stat label="Emotion" value={`${emotionEmoji(match.expression)} ${match.expression}`} />
          )}
        </div>

        {/* ---- Dojah NIN verify ---- */}
        <div className="mt-5 rounded-xl border border-border bg-card/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Dojah KYC · NIN Lookup
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 12))}
              placeholder="NIN (e.g. 12345678901)"
              inputMode="numeric"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={runVerify}
              disabled={verifying || !nin}
              className="glow-hover inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
            </button>
          </div>

          {result && !result.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          {result?.ok && result.record && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                {result.record.photo && (
                  <img
                    src={`data:image/jpeg;base64,${result.record.photo}`}
                    alt="NIN photo"
                    className="h-20 w-20 rounded-lg border border-primary/40 object-cover"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <p className="font-display text-lg leading-tight tracking-wide">
                    {[result.record.first_name, result.record.middle_name, result.record.last_name]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    NIN · {result.record.nin || nin}
                  </p>
                  {result.selfie && (
                    <p
                      className={`text-[11px] font-medium ${
                        result.selfie.match ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {result.selfie.match ? "✓ Face Match" : "✗ No Match"} ·{" "}
                      {result.selfie.confidenceValue.toFixed(1)}%
                    </p>
                  )}
                  {result.liveness && (
                    <p
                      className={`text-[11px] ${
                        result.liveness.passed ? "text-primary" : "text-destructive"
                      }`}
                    >
                      Liveness {result.liveness.passed ? "Passed" : "Failed"} ·{" "}
                      {result.liveness.liveness_probability.toFixed(0)}%
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {result.record.date_of_birth && (
                  <Stat label="DOB" value={result.record.date_of_birth} />
                )}
                {result.record.gender && <Stat label="Gender" value={result.record.gender} />}
                {result.record.phone_number && (
                  <Stat label="Phone" value={result.record.phone_number} />
                )}
                {result.record.nationality && (
                  <Stat label="Nationality" value={result.record.nationality} />
                )}
                {result.record.state_of_origin && (
                  <Stat label="State" value={result.record.state_of_origin} />
                )}
                {result.record.place_of_birth && (
                  <Stat label="Place of Birth" value={result.record.place_of_birth} />
                )}
                {result.record.address && (
                  <div className="col-span-2">
                    <Stat label="Address" value={result.record.address} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {sightings.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Previous Sightings · {sightings.length}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {sightings.map((s) => (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-lg border border-border bg-card/60"
                  title={`${s.feed} — ${new Date(s.time).toLocaleString()}`}
                >
                  {s.thumbnail ? (
                    <img
                      src={s.thumbnail}
                      alt=""
                      className="h-16 w-full object-cover"
                    />
                  ) : (
                    <div className="h-16 w-full bg-muted" />
                  )}
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[9px] uppercase tracking-[0.18em]">
                      {s.feed}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(s.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/profile/$id"
          params={{ id: identity.id }}
          className="glow-hover mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          View Full Profile
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm">{value}</p>
    </div>
  );
}
