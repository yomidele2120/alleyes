import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { dojahAmlScreen, type DojahAmlResult } from "@/lib/dojah.functions";

export const Route = createFileRoute("/aml")({
  head: () => ({
    meta: [
      { title: "AML Screening · LENS" },
      {
        name: "description",
        content:
          "Screen names against global watchlists — sanctions, PEP, adverse media. Powered by Dojah AML.",
      },
      { property: "og:title", content: "AML — Watchlist Screening · LENS" },
      {
        property: "og:description",
        content: "Instant name-based screening against sanctions, PEP, and adverse media watchlists.",
      },
    ],
  }),
  component: AmlPage,
});

function AmlPage() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DojahAmlResult | null>(null);
  const screen = useServerFn(dojahAmlScreen);

  const submit = async () => {
    setBusy(true);
    setRes(null);
    try {
      setRes(
        await screen({
          data: {
            first_name: first.trim(),
            last_name: last.trim(),
            date_of_birth: dob || undefined,
          },
        }),
      );
    } catch (e) {
      setRes({
        ok: false,
        error: e instanceof Error ? e.message : "Failed",
        hits: [],
        clean: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 md:pt-28">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Service · AML</p>
        <h1 className="mt-2 font-display text-4xl tracking-[0.08em]">Watchlist Screening</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Screen any individual against global sanctions lists (OFAC, EU, UN), politically exposed
          persons (PEP), and adverse media in real time.
        </p>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="First Name">
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              placeholder="John"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Last Name">
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              placeholder="Doe"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
          <Field label="Date of Birth (optional)">
            <input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="1980-01-15"
              type="date"
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>

        <button
          onClick={submit}
          disabled={busy || !first || !last}
          className="glow-hover mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          Run Screening
        </button>

        {res && !res.ok && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{res.error}</span>
          </div>
        )}

        {res?.ok && (
          <div className="mt-6 border-t border-border pt-5">
            {res.clean ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <ShieldCheck className="h-6 w-6 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">No Matches Found</p>
                  <p className="text-[11px] text-emerald-300/70">
                    {first} {last} does not appear on any monitored watchlist.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-medium text-destructive">
                    {res.hits.length} watchlist hit{res.hits.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="space-y-2">
                  {res.hits.map((h, i) => (
                    <div key={i} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium">{h.name || "Unknown"}</p>
                        {h.match_percentage != null && (
                          <span className="text-[10px] uppercase tracking-[0.2em] text-destructive">
                            {h.match_percentage}% match
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        {h.source && <span>Source: {h.source}</span>}
                        {h.category && <span>Category: {h.category}</span>}
                        {h.country && <span>Country: {h.country}</span>}
                        {h.designation && <span>Position: {h.designation}</span>}
                        {h.date_of_birth && <span>DOB: {h.date_of_birth}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
