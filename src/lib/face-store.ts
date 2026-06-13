// Face descriptor storage in localStorage
export type Identity = {
  id: string;
  name: string;
  descriptor: number[]; // 128-d float vector
  createdAt: number;
};

const KEY = "lens.identities.v1";

export function loadIdentities(): Identity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Identity[];
  } catch {
    return [];
  }
}

export function saveIdentities(items: Identity[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addIdentity(name: string, descriptor: Float32Array): Identity {
  const items = loadIdentities();
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const item: Identity = {
    id,
    name,
    descriptor: Array.from(descriptor),
    createdAt: Date.now(),
  };
  items.push(item);
  saveIdentities(items);
  return item;
}

export function removeIdentity(id: string) {
  saveIdentities(loadIdentities().filter((i) => i.id !== id));
}
