// Detection log — capped scrollback in localStorage.
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
