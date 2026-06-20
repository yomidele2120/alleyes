// Detection log — capped scrollback in localStorage.
import { backendConnection, backendClearLogs, backendListLogs } from "@/lib/lens-backend";

export type LogEntry = {
  id: string;
  identityId: string | null;
  name: string;
  feed: string;
  time: number;
  confidence: number;
  thumbnail: string; // dataURL
};

const KEY = "lens.log.v1";
const MAX = 500;

function isInsightfaceActive() {
  return backendConnection.getSnapshot().status === "insightface";
}

function mapBackendLog(entry: Record<string, unknown>): LogEntry {
  return {
    id: String(entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    identityId: (entry.identity_id as string | null) ?? null,
    name: (entry.full_name as string | null) ?? (entry.identity_name as string | null) ?? "Unknown",
    feed: (entry.camera_name as string | null) ?? (entry.feed_name as string | null) ?? "Backend",
    time: entry.detected_at ? new Date(String(entry.detected_at)).getTime() : Date.now(),
    confidence: Number(entry.confidence ?? 0),
    thumbnail: (entry.snapshot_url as string) ?? "",
  };
}

export async function syncLogFromBackend() {
  if (!isInsightfaceActive()) return loadLog();
  try {
    const remote = await backendListLogs({ limit: MAX });
    const mapped = remote.map((entry) => mapBackendLog(entry as Record<string, unknown>));
    localStorage.setItem(KEY, JSON.stringify(mapped));
    window.dispatchEvent(new Event("lens:log"));
    return mapped;
  } catch {
    return loadLog();
  }
}

export function loadLog(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as LogEntry[];
  } catch {
    return [];
  }
}

export function saveLog(entries: LogEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  window.dispatchEvent(new Event("lens:log"));
}

export function addLogEntry(e: Omit<LogEntry, "id">) {
  const all = loadLog();
  all.unshift({ ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  saveLog(all);
}

export function clearLog() {
  saveLog([]);
  if (isInsightfaceActive()) {
    void backendClearLogs().catch(() => {});
  }
}

export function recentSightings(identityId: string, limit = 6): LogEntry[] {
  return loadLog()
    .filter((e) => e.identityId === identityId)
    .slice(0, limit);
}

export function exportCsv(): string {
  const all = loadLog();
  const rows = [
    ["Time", "Name", "Camera", "Confidence", "IdentityId"],
    ...all.map((e) => [
      new Date(e.time).toISOString(),
      e.name,
      e.feed,
      String(Math.round(e.confidence * 100)),
      e.identityId ?? "",
    ]),
  ];
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
