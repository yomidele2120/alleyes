import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Filter, Trash2 } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { clearLog, exportCsv, loadLog, type LogEntry } from "@/lib/detection-log";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { syncLogFromBackend } from "@/lib/detection-log";

export const Route = createFileRoute("/log")({
  head: () => ({
    meta: [
      { title: "Log · LENS" },
      {
        name: "description",
        content:
          "Detection timeline with thumbnails, filters, and CSV export. All data stays on your device.",
      },
    ],
  }),
  component: LogPage,
});

function LogPage() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [name, setName] = useState("");
  const [feed, setFeed] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [date, setDate] = useState("");
  const { status } = useBackendHealth();

  useEffect(() => {
    const sync = () => setLog(loadLog());
    sync();
    window.addEventListener("lens:log", sync);
    return () => window.removeEventListener("lens:log", sync);
  }, []);

  useEffect(() => {
    if (status === "insightface") {
      void syncLogFromBackend();
    }
  }, [status]);

  const names = useMemo(() => Array.from(new Set(log.map((l) => l.name))).sort(), [log]);
  const feeds = useMemo(() => Array.from(new Set(log.map((l) => l.feed))).sort(), [log]);

  const filtered = useMemo(() => {
    return log.filter((l) => {
      if (name && l.name !== name) return false;
      if (feed && l.feed !== feed) return false;
      if (l.confidence < minConf) return false;
      if (date) {
        const d = new Date(l.time);
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        if (d < start || d >= end) return false;
      }
      return true;
    });
  }, [log, name, feed, minConf, date]);

  const onExport = () => {
    const csv = exportCsv();
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lens-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onClear = () => {
    if (confirm("Delete all detection log entries? This cannot be undone.")) {
      clearLog();
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-4xl px-4 pt-24">
        <header className="animate-fade-in mb-5 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
              Timeline
            </p>
            <h1 className="mt-1 font-display text-4xl tracking-[0.15em]">Log</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="glow-hover inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs uppercase tracking-[0.25em] text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={onClear}
              className="glow-hover inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs uppercase tracking-[0.25em] text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        </header>

        {/* Filters */}
        <div className="glass mb-4 grid grid-cols-2 gap-2 rounded-2xl p-3 sm:grid-cols-4">
          <div className="col-span-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:col-span-1">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-input/40 px-2 py-1.5 text-xs"
          >
            <option value="">All names</option>
            {names.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={feed}
            onChange={(e) => setFeed(e.target.value)}
            className="rounded-md border border-border bg-input/40 px-2 py-1.5 text-xs"
          >
            <option value="">All feeds</option>
            {feeds.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-input/40 px-2 py-1.5 text-xs"
          />
          <label className="col-span-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:col-span-4">
            Min Confidence: {Math.round(minConf * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={minConf}
              onChange={(e) => setMinConf(Number(e.target.value))}
              className="flex-1 accent-[var(--primary)]"
            />
          </label>
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No detections matching your filters.
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((l) => (
              <li
                key={l.id}
                className="glow-hover flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3"
              >
                {l.thumbnail ? (
                  <img
                    src={l.thumbnail}
                    alt={l.name}
                    className="h-12 w-12 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    —
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{l.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {l.feed} · {new Date(l.time).toLocaleString()}
                  </p>
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: l.identityId ? "var(--primary)" : "color-mix(in oklab, var(--muted-foreground) 70%, black)",
                    color: "var(--background)",
                  }}
                >
                  {Math.round(l.confidence * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
