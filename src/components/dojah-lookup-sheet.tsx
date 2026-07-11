import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X, ShieldCheck, Loader2, AlertTriangle, ScanFace } from "lucide-react";
import { dojahVerifyNin, type DojahVerifyResult } from "@/lib/dojah.functions";

/**
 * Standalone Dojah NIN lookup sheet — used for unknown faces on the identify
 * feed so the operator can identify them against the government database
 * without needing a pre-enrolled Identity.
 */
export function DojahLookupSheet({
  onClose,
  getSnapshot,
  title = "Unknown Subject",
  subtitle = "Not in your enrolled identities",
}: {
  onClose: () => void;
  getSnapshot?: () => string | null;
  title?: string;
  subtitle?: string;
}) {
  const [nin, setNin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DojahVerifyResult | null>(null);
  const verify = useServerFn(dojahVerifyNin);
  const [snapshot] = useState<string | null>(() => getSnapshot?.() ?? null);

  const run = async () => {
    if (!/^\d{8,12}$/.test(nin)) {
      setResult({ ok: false, error: "Enter a valid NIN (11 digits). Sandbox: 70123456789" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await verify({ data: { nin, selfieBase64: snapshot || undefined } }),
      );
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Verification failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm">
      <div className="glass animate-fade-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:mb-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {snapshot ? (
              <img
                src={snapshot}
                alt=""
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
                <ScanFace className="h-6 w-6" />
              </div>
            )}
            <div>
              <p className="font-display text-xl tracking-[0.1em]">{title}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {subtitle}
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

        <div className="rounded-xl border border-border bg-card/60 p-4">
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
              placeholder="NIN e.g. 70123456789"
              inputMode="numeric"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={run}
              disabled={busy || !nin}
              className="glow-hover inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
            </button>
          </div>

          {result && !result.ok && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}

          {result?.ok && result.record && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-3">
                {result.record.photo && (
                  <img
                    src={`data:image/jpeg;base64,${result.record.photo}`}
                    alt=""
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
