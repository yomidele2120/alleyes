import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, AlertTriangle, IdCard, Fingerprint, Download } from "lucide-react";
import {
  dojahVerifyNin,
  dojahLookupBvn,
  type DojahVerifyResult,
  type DojahBvnResult,
} from "@/lib/dojah.functions";
import { exportLookupPdf } from "@/lib/pdf-export";

export const Route = createFileRoute("/kyc")({
  head: () => ({
    meta: [
      { title: "KYC · LENS" },
      {
        name: "description",
        content:
          "Government-verified identity lookups — NIN and BVN — powered by Dojah. Instant KYC for onboarding, fraud checks, and investigations.",
      },
      { property: "og:title", content: "KYC — Identity Verification · LENS" },
      {
        property: "og:description",
        content: "Verify NIN and BVN against Nigerian government databases in seconds.",
      },
    ],
  }),
  component: KycPage,
});

type Mode = "nin" | "bvn";

function KycPage() {
  const [mode, setMode] = useState<Mode>("nin");
  return (
    <main className="mx-auto max-w-3xl px-4 pt-24 pb-24 md:pt-28">
      <div className="mb-8">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Service · KYC</p>
        <h1 className="mt-2 font-display text-4xl tracking-[0.08em]">Identity Verification</h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Look up any Nigerian citizen against the NIMC (NIN) or CBN (BVN) database. Returns
          government-registered name, DOB, photo, and contact record.
        </p>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-border bg-card/60 p-1">
        <TabBtn active={mode === "nin"} onClick={() => setMode("nin")} icon={<IdCard className="h-3.5 w-3.5" />}>
          NIN Lookup
        </TabBtn>
        <TabBtn active={mode === "bvn"} onClick={() => setMode("bvn")} icon={<Fingerprint className="h-3.5 w-3.5" />}>
          BVN Lookup
        </TabBtn>
      </div>

      {mode === "nin" ? <NinPanel /> : <BvnPanel />}
    </main>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] uppercase tracking-[0.2em] transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function NinPanel() {
  const [nin, setNin] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DojahVerifyResult | null>(null);
  const verify = useServerFn(dojahVerifyNin);

  const submit = async () => {
    setBusy(true);
    setRes(null);
    try {
      setRes(await verify({ data: { nin } }));
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        NIN (National ID Number)
      </label>
      <div className="mt-2 flex gap-2">
        <input
          value={nin}
          onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="70123456789"
          inputMode="numeric"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={busy || nin.length !== 11}
          className="glow-hover inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Verify
        </button>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Sandbox test NIN · 70123456789
      </p>

      {res && !res.ok && <ErrorNote>{res.error}</ErrorNote>}
      {res?.ok && res.record && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex gap-4">
            {res.record.photo && (
              <img
                src={`data:image/jpeg;base64,${res.record.photo}`}
                alt=""
                className="h-24 w-24 rounded-lg border border-primary/40 object-cover"
              />
            )}
            <div className="flex-1">
              <p className="font-display text-2xl tracking-[0.06em]">
                {[res.record.first_name, res.record.middle_name, res.record.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-primary">
                NIN · {res.record.nin || nin}
              </p>
            </div>
          </div>
          {(() => {
            const rows: Array<[string, string | undefined]> = [
              ["DOB", res.record.date_of_birth],
              ["Gender", res.record.gender],
              ["Phone", res.record.phone_number],
              ["Nationality", res.record.nationality],
              ["State of Origin", res.record.state_of_origin],
              ["Place of Birth", res.record.place_of_birth],
              ["Address", res.record.address],
              ["Email", res.record.email],
              ["Marital Status", res.record.marital_status],
            ];
            const fullName = [res.record.first_name, res.record.middle_name, res.record.last_name].filter(Boolean).join(" ");
            return (
              <>
                <RecordGrid rows={rows} />
                <ExportBtn
                  onClick={() =>
                    exportLookupPdf({
                      title: "NIN Verification Report",
                      reference: `NIN · ${res.record?.nin || nin}`,
                      fullName,
                      photoBase64: res.record?.photo,
                      rows,
                      filename: `LENS-NIN-${res.record?.nin || nin}.pdf`,
                    })
                  }
                />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function BvnPanel() {
  const [bvn, setBvn] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<DojahBvnResult | null>(null);
  const lookup = useServerFn(dojahLookupBvn);

  const submit = async () => {
    setBusy(true);
    setRes(null);
    try {
      setRes(await lookup({ data: { bvn } }));
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <label className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        BVN (Bank Verification Number)
      </label>
      <div className="mt-2 flex gap-2">
        <input
          value={bvn}
          onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="22222222222"
          inputMode="numeric"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={busy || bvn.length !== 11}
          className="glow-hover inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Look Up
        </button>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Sandbox test BVN · 22222222222
      </p>

      {res && !res.ok && <ErrorNote>{res.error}</ErrorNote>}
      {res?.ok && res.record && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex gap-4">
            {res.record.image && (
              <img
                src={`data:image/jpeg;base64,${res.record.image}`}
                alt=""
                className="h-24 w-24 rounded-lg border border-primary/40 object-cover"
              />
            )}
            <div className="flex-1">
              <p className="font-display text-2xl tracking-[0.06em]">
                {[res.record.first_name, res.record.middle_name, res.record.last_name]
                  .filter(Boolean)
                  .join(" ")}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-primary">
                BVN · {res.record.bvn || bvn}
              </p>
            </div>
          </div>
          <RecordGrid
            rows={[
              ["DOB", res.record.date_of_birth],
              ["Gender", res.record.gender],
              ["Phone 1", res.record.phone_number1],
              ["Phone 2", res.record.phone_number2],
              ["Email", res.record.email],
              ["Marital Status", res.record.marital_status],
              ["Nationality", res.record.nationality],
              ["State of Origin", res.record.state_of_origin],
              ["State of Residence", res.record.state_of_residence],
              ["Enrollment Bank", res.record.enrollment_bank],
              ["Enrollment Branch", res.record.enrollment_branch],
              ["Address", res.record.residential_address],
            ]}
          />
        </div>
      )}
    </div>
  );
}

function RecordGrid({ rows }: { rows: Array<[string, string | undefined]> }) {
  const filled = rows.filter(([, v]) => v);
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {filled.map(([k, v]) => (
        <div key={k} className="rounded-lg border border-border bg-card/60 p-3">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{k}</p>
          <p className="mt-1 truncate text-sm">{v}</p>
        </div>
      ))}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
