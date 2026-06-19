// Optional Python/InsightFace backend client.
// If unreachable, callers should fall back to the in-browser face-api.js engine.
import { loadSettings } from "./settings-store";

export type BackendHealth = {
  status: "ok" | "error";
  model_loaded: boolean;
  identity_count: number;
  active_streams: number;
};

export type BackendDetection = {
  box: { x: number; y: number; w: number; h: number };
  name?: string;
  nin?: string;
  confidence: number;
  age_estimate?: number;
  gender?: string;
  identity_id?: string;
  group_tag?: string;
  is_unknown: boolean;
  is_target?: boolean;
};

function backendUrl() {
  const s = loadSettings();
  return s.backendUrl?.replace(/\/+$/, "") || "http://localhost:8000";
}

export function mediamtxUrl() {
  const s = loadSettings();
  return s.mediamtxUrl?.replace(/\/+$/, "") || "http://localhost:8888";
}

export function wsUrl() {
  const s = loadSettings();
  return s.wsUrl || "ws://localhost:3001";
}

export function hlsUrlFor(rtmpKey: string) {
  return `${mediamtxUrl()}/${rtmpKey}/index.m3u8`;
}

export function rtmpPushUrlFor(rtmpKey: string) {
  // Best-effort: derive RTMP host from MediaMTX URL host
  try {
    const u = new URL(mediamtxUrl());
    return `rtmp://${u.hostname}:1935/${rtmpKey}`;
  } catch {
    return `rtmp://YOUR_SERVER:1935/${rtmpKey}`;
  }
}

export async function pingBackend(signal?: AbortSignal): Promise<BackendHealth | null> {
  try {
    const res = await fetch(`${backendUrl()}/api/health`, { signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BackendHealth;
  } catch {
    return null;
  }
}

export async function backendIdentify(jpeg: Blob): Promise<BackendDetection[] | null> {
  try {
    const fd = new FormData();
    fd.append("image", jpeg, "frame.jpg");
    const res = await fetch(`${backendUrl()}/api/identify`, { method: "POST", body: fd });
    if (!res.ok) return null;
    return (await res.json()) as BackendDetection[];
  } catch {
    return null;
  }
}

export async function backendSetTargets(identityIds: string[]) {
  try {
    await fetch(`${backendUrl()}/api/search/targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity_ids: identityIds }),
    });
  } catch {
    /* ignore */
  }
}
