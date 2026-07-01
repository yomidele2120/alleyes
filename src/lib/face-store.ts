// LENS identity store. localStorage only — nothing leaves the device.
import {
  backendConnection,
  backendDeleteIdentity,
  backendEnrollAngles,
  backendEnrollIdentity,
  backendListIdentities,
  backendUpdateIdentity,
  type BackendIdentity,
} from "@/lib/lens-backend";

export type Identity = {
  id: string;
  name: string;
  /** One or more 128-d descriptors (multi-angle enrollment). */
  descriptors: number[][];
  /** Per-angle thumbnails (dataURL, ~96x96 jpeg). */
  thumbnails: string[];
  group: string; // "Family" | "Team" | "Watch List" | custom | ""
  notes: string;
  /** Optional Nigerian ID number for Dojah KYC lookup. */
  nin?: string;
  detectionCount: number;
  lastSeen: number | null;
  firstEnrolled: number;
  createdAt: number;
};

const KEY = "lens.identities.v2";
const LEGACY_KEY = "lens.identities.v1";

function isInsightfaceActive() {
  return backendConnection.getSnapshot().status === "insightface";
}

async function toBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const response = await fetch(dataUrl);
    return await response.blob();
  } catch {
    return null;
  }
}

function mapBackendIdentity(item: BackendIdentity): Identity {
  const descriptors =
    item.embeddings_multi?.length
      ? item.embeddings_multi
      : item.embedding
        ? [item.embedding]
        : [];

  return {
    id: item.id,
    name: item.full_name,
    descriptors,
    thumbnails: item.photo_url ? [item.photo_url] : [],
    group: item.group_tag || "",
    notes: item.notes || "",
    detectionCount: 0,
    lastSeen: null,
    firstEnrolled: item.enrolled_at ? new Date(item.enrolled_at).getTime() : Date.now(),
    createdAt: item.enrolled_at ? new Date(item.enrolled_at).getTime() : Date.now(),
  };
}

export async function syncIdentitiesFromBackend() {
  if (!isInsightfaceActive()) return loadIdentities();
  try {
    const remote = await backendListIdentities({ limit: 500 });
    const mapped = remote.map(mapBackendIdentity);
    localStorage.setItem(KEY, JSON.stringify(mapped));
    window.dispatchEvent(new Event("lens:identities"));
    return mapped;
  } catch {
    return loadIdentities();
  }
}

export async function syncIdentitiesToBackend(items: Identity[]) {
  if (!isInsightfaceActive()) return;
  for (const item of items) {
    try {
      const patch = {
        full_name: item.name,
        group_tag: item.group,
        notes: item.notes,
        embeddings_multi: item.descriptors,
      };
      await backendUpdateIdentity(item.id, patch).catch(async () => {
        const imageBlob = item.thumbnails[0] ? await toBlob(item.thumbnails[0]) : null;
        if (!imageBlob) return;
        const remote = await backendEnrollIdentity({
          fullName: item.name,
          idType: "",
          groupTag: item.group,
          notes: item.notes,
          image: imageBlob,
        });
        for (const thumb of item.thumbnails.slice(1)) {
          const blob = await toBlob(thumb);
          if (blob) await backendEnrollAngles(remote.id, blob).catch(() => {});
        }
      });
    } catch {
      // best-effort only
    }
  }
}

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
  if (isInsightfaceActive()) {
    void (async () => {
      try {
        const imageBlob = thumbnails[0] ? await toBlob(thumbnails[0]) : null;
        if (!imageBlob) return;
        const remote = await backendEnrollIdentity({
          fullName: name,
          idType: "",
          groupTag: group,
          notes: "",
          image: imageBlob,
        });
        for (const thumb of thumbnails.slice(1)) {
          const blob = await toBlob(thumb);
          if (blob) await backendEnrollAngles(remote.id, blob).catch(() => {});
        }
      } catch {
        // best-effort sync only
      }
    })();
  }
  return item;
}

export function updateIdentity(id: string, patch: Partial<Identity>) {
  const items = loadIdentities().map((i) => (i.id === id ? { ...i, ...patch } : i));
  saveIdentities(items);
  if (isInsightfaceActive()) {
    void backendUpdateIdentity(id, {
      full_name: patch.name,
      group_tag: patch.group,
      notes: patch.notes,
      embeddings_multi: patch.descriptors,
    }).catch(() => {});
  }
}

export function removeIdentity(id: string) {
  saveIdentities(loadIdentities().filter((i) => i.id !== id));
  if (isInsightfaceActive()) {
    void backendDeleteIdentity(id).catch(() => {});
  }
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
