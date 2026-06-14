// LENS identity store. localStorage only — nothing leaves the device.
export type Identity = {
  id: string;
  name: string;
  /** One or more 128-d descriptors (multi-angle enrollment). */
  descriptors: number[][];
  /** Per-angle thumbnails (dataURL, ~96x96 jpeg). */
  thumbnails: string[];
  group: string; // "Family" | "Team" | "Watch List" | custom | ""
  notes: string;
  detectionCount: number;
  lastSeen: number | null;
  firstEnrolled: number;
  createdAt: number;
};

const KEY = "lens.identities.v2";
const LEGACY_KEY = "lens.identities.v1";

function migrate(): Identity[] {
  // Migrate v1 single-descriptor identities to v2.
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const old = JSON.parse(raw) as Array<{
      id: string;
      name: string;
      descriptor: number[];
      createdAt: number;
    }>;
    const mapped: Identity[] = old.map((o) => ({
      id: o.id,
      name: o.name,
      descriptors: [o.descriptor],
      thumbnails: [],
      group: "",
      notes: "",
      detectionCount: 0,
      lastSeen: null,
      firstEnrolled: o.createdAt,
      createdAt: o.createdAt,
    }));
    localStorage.setItem(KEY, JSON.stringify(mapped));
    localStorage.removeItem(LEGACY_KEY);
    return mapped;
  } catch {
    return [];
  }
}

export function loadIdentities(): Identity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return migrate();
    return JSON.parse(raw) as Identity[];
  } catch {
    return [];
  }
}

export function saveIdentities(items: Identity[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("lens:identities"));
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addIdentity(
  name: string,
  descriptors: Float32Array[],
  thumbnails: string[],
  group = "",
): Identity {
  const items = loadIdentities();
  const now = Date.now();
  const item: Identity = {
    id: uid(),
    name,
    descriptors: descriptors.map((d) => Array.from(d)),
    thumbnails,
    group,
    notes: "",
    detectionCount: 0,
    lastSeen: null,
    firstEnrolled: now,
    createdAt: now,
  };
  items.push(item);
  saveIdentities(items);
  return item;
}

export function updateIdentity(id: string, patch: Partial<Identity>) {
  const items = loadIdentities().map((i) => (i.id === id ? { ...i, ...patch } : i));
  saveIdentities(items);
}

export function removeIdentity(id: string) {
  saveIdentities(loadIdentities().filter((i) => i.id !== id));
}

export function bumpDetection(id: string) {
  const items = loadIdentities();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items[idx] = {
    ...items[idx],
    detectionCount: items[idx].detectionCount + 1,
    lastSeen: Date.now(),
  };
  saveIdentities(items);
}
