import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Crosshair,
  Eye,
  Server,
  UserPlus,
  IdCard,
  ShieldAlert,
  Monitor,
  ScanFace,
} from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { loadIdentities, type Identity } from "@/lib/face-store";
import { loadLog, type LogEntry } from "@/lib/detection-log";
import { loadFeeds, type Feed } from "@/lib/feed-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LENS — Identify. Enroll. Locate." },
      {
        name: "description",
        content:
          "LENS dashboard: enrolled identities, active feeds, today's detections, and quick search.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const sync = () => {
      setIdentities(loadIdentities());
      setFeeds(loadFeeds());
      setLog(loadLog());
    };
    sync();
    ["lens:identities", "lens:feeds", "lens:log"].forEach((e) =>
      window.addEventListener(e, sync),
    );
    return () =>
      ["lens:identities", "lens:feeds", "lens:log"].forEach((e) =>
        window.removeEventListener(e, sync),
      );
  }, []);

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return log.filter((l) => l.time >= start.getTime()).length;
  }, [log]);

  const filtered = useMemo(
    () =>
      q
        ? identities.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
        : identities.slice(0, 6),
    [q, identities],
  );

  return (
    <div className="relative min-h-screen overflow-hidden mesh-bg pb-28 md:pb-10">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <LensNav />

      <main className="relative mx-auto max-w-5xl px-5 pt-24">
        <header className="animate-fade-in mb-8 text-center">
          <h1 className="font-display text-5xl tracking-[0.3em]">LENS</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Command Center
          </p>
        </header>

        {/* Stats row */}
        <section className="animate-fade-in grid grid-cols-3 gap-3">
          <StatCard label="Identities" value={identities.length} icon={UserPlus} />
          <StatCard label="Cameras Active" value={feeds.length} icon={Server} accent />
          <StatCard label="Detections Today" value={todayCount} icon={Eye} />
        </section>

        {/* Quick actions */}
        <section className="animate-fade-in mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink to="/enroll" label="Enroll" icon={UserPlus} />
          <QuickLink to="/identify" label="Identify" icon={Eye} />
          <QuickLink to="/search" label="Search" icon={Crosshair} />
          <QuickLink to="/network" label="Network" icon={Server} />
        </section>

        {/* Services */}
        <section className="animate-fade-in mt-10">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Services</p>
              <h2 className="mt-1 font-display text-2xl tracking-[0.08em]">What LENS offers</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ServiceCard
              to="/live"
              badge="01 · Surveillance"
              title="Live Face Recognition"
              desc="Watch multiple camera feeds, detect and match known identities in real time with on-device intelligence."
              icon={Monitor}
            />
            <ServiceCard
              to="/kyc"
              badge="02 · KYC"
              title="Identity Verification"
              desc="Look up any Nigerian citizen against NIMC (NIN) and CBN (BVN). Government-registered name, DOB, photo, and contact."
              icon={IdCard}
              accent
            />
            <ServiceCard
              to="/identify"
              badge="03 · Investigate"
              title="Identify & Match"
              desc="Capture a face, run liveness, and match against your enrolled roster or Dojah's NIN database for instant intel."
              icon={ScanFace}
            />
            <ServiceCard
              to="/aml"
              badge="04 · AML"
              title="Sanctions & PEP Screening"
              desc="Screen names against global watchlists — sanctions, politically exposed persons, and adverse media."
              icon={ShieldAlert}
              accent
            />
          </div>
        </section>

        {/* Quick search */}
        <section className="animate-fade-in mt-8">
          <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Quick search
          </p>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a name to start searching..."
            className="w-full rounded-lg border border-border bg-input/40 px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          {filtered.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {filtered.map((i) => (
                <li key={i.id}>
                  <Link
                    to="/search"
                    className="glow-hover flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5"
                  >
                    {i.thumbnails[0] ? (
                      <img src={i.thumbnails[0]} alt={i.name}
                        className="h-8 w-8 rounded-full border border-border object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs text-primary">
                        {i.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-sm">{i.name}</span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent detections */}
        <section className="animate-fade-in mt-8">
          <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Recent detections
          </p>
          {log.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No detections yet — run Identify or Network.
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {log.slice(0, 8).map((l) => (
                <div
                  key={l.id}
                  className="glass min-w-[140px] flex-shrink-0 rounded-xl p-3"
                >
                  {l.thumbnail && (
                    <img
                      src={l.thumbnail}
                      alt={l.name}
                      className="h-16 w-full rounded-lg border border-border object-cover"
                    />
                  )}
                  <p className="mt-2 truncate text-xs">{l.name}</p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                    {l.feed} · {Math.round(l.confidence * 100)}%
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-10 mt-10 border-t border-border/50 py-6 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        On-device intelligence. Nothing leaves your browser.
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof UserPlus;
  accent?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <Icon
        className="h-4 w-4"
        strokeWidth={1.5}
        style={{ color: accent ? "var(--gold)" : "var(--primary)" }}
      />
      <p className="mt-3 font-display text-3xl tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof UserPlus;
}) {
  return (
    <Link
      to={to}
      className="glow-hover flex items-center justify-between rounded-xl border border-border bg-card/60 p-3"
    >
      <span className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-primary" strokeWidth={1.6} />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
