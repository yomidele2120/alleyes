// Centralized Railway backend client + realtime connection manager.
import { loadSettings } from "./settings-store";

export type BackendHealth = {
  status: "ok" | "error";
  model_loaded: boolean;
  identity_count?: number;
  active_streams?: number;
};

export type BackendConnectionStatus = "checking" | "insightface" | "local" | "offline";

export type BackendDetection = {
  box: { x: number; y: number; w: number; h: number };
  name?: string;
  nin?: string;
  confidence: number;
  age_estimate?: number;
  gender?: string;
  identity_id?: string;
  group_tag?: string;
  is_unknown?: boolean;
  is_target?: boolean;
};

export type BackendIdentity = {
  id: string;
  full_name: string;
  nin: string | null;
  id_type: string;
  group_tag: string;
  notes: string | null;
  photo_url: string | null;
  embeddings_multi?: number[][];
  embedding?: number[] | null;
  enrolled_at?: string;
  is_active?: boolean;
  [key: string]: unknown;
};

export type BackendCamera = {
  id: string;
  name: string;
  location: string | null;
  rtmp_key: string;
  stream_url: string | null;
  is_active: boolean;
  [key: string]: unknown;
};

export type BackendLog = {
  id: string;
  identity_id: string | null;
  camera_id: string | null;
  confidence: number | null;
  detected_at: string;
  full_name?: string | null;
  camera_name?: string | null;
  snapshot_url?: string | null;
  age_estimate?: number | null;
  gender?: string | null;
  [key: string]: unknown;
};

type RealtimeEventName = "detection" | "target_found" | "camera_status" | "targets_updated";

type RealtimeEnvelope = {
  event?: string;
  type?: string;
  name?: string;
  data?: unknown;
  payload?: unknown;
  [key: string]: unknown;
};

type ConnectionSnapshot = {
  status: BackendConnectionStatus;
  health: BackendHealth | null;
  wsState: number | null;
  lastError: string | null;
};

const DEFAULT_BACKEND_URL = "https://lenzbackend-production.up.railway.app";
const DEFAULT_WS_URL = "wss://lenzbackend-production.up.railway.app/ws";
const HEALTH_TIMEOUT_MS = 5000;
const API_TIMEOUT_MS = 12000;
const RECONNECT_DELAY_MS = 3000;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function backendUrl() {
  const env = import.meta.env.VITE_BACKEND_URL as string | undefined;
  return trimTrailingSlash(env || DEFAULT_BACKEND_URL);
}

export function wsUrl() {
  const env = import.meta.env.VITE_WS_URL as string | undefined;
  return trimTrailingSlash(env || DEFAULT_WS_URL);
}

export function mediamtxUrl() {
  const settingsUrl = typeof window === "undefined" ? undefined : loadSettings().mediamtxUrl;
  return trimTrailingSlash(settingsUrl || "http://localhost:8888");
}

export function hlsUrlFor(rtmpKey: string) {
  return `${mediamtxUrl()}/${rtmpKey}/index.m3u8`;
}

export function rtmpPushUrlFor(rtmpKey: string) {
  try {
    const u = new URL(mediamtxUrl());
    return `rtmp://${u.hostname}:1935/${rtmpKey}`;
  } catch {
    return `rtmp://YOUR_SERVER:1935/${rtmpKey}`;
  }
}

function friendlyError(status?: number) {
  if (!status) return "Unable to reach the backend";
  if (status >= 500) return "Backend service is temporarily unavailable";
  if (status === 404) return "Requested backend resource was not found";
  return "Backend request failed";
}

function composeAbortSignal(signal?: AbortSignal, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(friendlyError(res.status));
  }
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Backend returned invalid JSON");
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const { signal, cleanup } = composeAbortSignal(init.signal, timeoutMs);
  try {
    const res = await fetch(`${backendUrl()}${path}`, {
      ...init,
      signal,
      cache: "no-store",
    });
    return await parseJsonResponse<T>(res);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") {
      throw new Error("Request timed out");
    }
    if (e instanceof Error) throw new Error(e.message || "Backend request failed");
    throw new Error("Backend request failed");
  } finally {
    cleanup();
  }
}

async function requestFormData<T>(path: string, formData: FormData, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  return requestJson<T>(path, { method: "POST", body: formData }, timeoutMs);
}

export async function pingBackend(signal?: AbortSignal): Promise<BackendHealth | null> {
  try {
    return await requestJson<BackendHealth>("/api/health", { method: "GET", signal }, HEALTH_TIMEOUT_MS);
  } catch {
    return null;
  }
}

export async function backendIdentify(jpeg: Blob): Promise<BackendDetection[] | null> {
  try {
    const fd = new FormData();
    fd.append("image", jpeg, "frame.jpg");
    return await requestFormData<BackendDetection[]>("/api/identify", fd);
  } catch {
    return null;
  }
}

export async function backendEnrollIdentity(input: {
  fullName: string;
  nin?: string;
  idType?: string;
  groupTag?: string;
  notes?: string;
  image: Blob;
}) {
  const fd = new FormData();
  fd.append("full_name", input.fullName);
  fd.append("nin", input.nin ?? "");
  fd.append("id_type", input.idType ?? "");
  fd.append("group_tag", input.groupTag ?? "");
  fd.append("notes", input.notes ?? "");
  fd.append("image", input.image, "enroll.jpg");
  return requestFormData<BackendIdentity>("/api/enroll", fd);
}

export async function backendEnrollAngles(id: string, image: Blob) {
  const fd = new FormData();
  fd.append("image", image, "angle.jpg");
  return requestFormData<BackendIdentity>(`/api/enroll/${id}/angles`, fd);
}

export async function backendBulkEnroll(csvFile: File) {
  const fd = new FormData();
  fd.append("csv_file", csvFile);
  return requestFormData<unknown>("/api/enroll/bulk", fd);
}

export async function backendListIdentities(opts?: { search?: string; group?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.group) params.set("group", opts.group);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<BackendIdentity[]>(`/api/identities${query}`, { method: "GET" });
}

export async function backendGetIdentity(id: string) {
  return requestJson<BackendIdentity>(`/api/identities/${id}`, { method: "GET" });
}

export async function backendUpdateIdentity(id: string, patch: Partial<BackendIdentity>) {
  return requestJson<BackendIdentity>(`/api/identities/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function backendDeleteIdentity(id: string) {
  return requestJson<{ ok: boolean }>(`/api/identities/${id}`, { method: "DELETE" });
}

export async function backendSetTargets(identityIds: string[]) {
  return requestJson<{ ok: boolean }>("/api/search/targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity_ids: identityIds }),
  });
}

export async function backendClearTargets() {
  return requestJson<{ ok: boolean }>("/api/search/targets", { method: "DELETE" });
}

export async function backendCreateCamera(input: { name: string; location?: string; rtmp_key: string }) {
  return requestJson<BackendCamera>("/api/cameras", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function backendListCameras() {
  return requestJson<BackendCamera[]>("/api/cameras", { method: "GET" });
}

export async function backendDeleteCamera(id: string) {
  return requestJson<{ ok: boolean }>(`/api/cameras/${id}`, { method: "DELETE" });
}

export async function backendListLogs(opts?: { identityId?: string; cameraId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.identityId) params.set("identity_id", opts.identityId);
  if (opts?.cameraId) params.set("camera_id", opts.cameraId);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<BackendLog[]>(`/api/logs${query}`, { method: "GET" });
}

export async function backendClearLogs() {
  return requestJson<{ ok: boolean }>("/api/logs", { method: "DELETE" });
}

export function normalizeBackendDetections(payload: unknown): BackendDetection[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as BackendDetection[];
  const record = payload as Record<string, unknown>;
  const detections = record.detections ?? record.results ?? record.items ?? record.data;
  if (Array.isArray(detections)) return detections as BackendDetection[];
  if (record.box) return [payload as BackendDetection];
  return [];
}

function isRealtimeEventName(value: string): value is RealtimeEventName {
  return value === "detection" || value === "target_found" || value === "camera_status" || value === "targets_updated";
}

class BackendConnectionManager extends EventTarget {
  private started = false;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private healthTimer: number | null = null;
  private localReady = false;
  private snapshot: ConnectionSnapshot = {
    status: "checking",
    health: null,
    wsState: null,
    lastError: null,
  };

  ensureStarted() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    void this.refreshHealth();
    void this.connectWs();
    this.healthTimer = window.setInterval(() => {
      void this.refreshHealth();
    }, 15000);
  }

  setLocalReady(ready: boolean) {
    this.localReady = ready;
    this.recomputeStatus();
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.addEventListener("state", listener as EventListener);
    return () => this.removeEventListener("state", listener as EventListener);
  }

  on(name: RealtimeEventName, listener: (detail: unknown) => void) {
    const handler = (event: Event) => listener((event as CustomEvent<unknown>).detail);
    this.addEventListener(name, handler);
    return () => this.removeEventListener(name, handler);
  }

  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.healthTimer) {
      window.clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.started = false;
  }

  private emitState() {
    this.dispatchEvent(new Event("state"));
  }

  private setSnapshot(patch: Partial<ConnectionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emitState();
  }

  private recomputeStatus() {
    if (this.snapshot.health?.status === "ok" && this.snapshot.health.model_loaded) {
      this.setSnapshot({ status: "insightface", lastError: null });
      return;
    }
    if (this.localReady) {
      this.setSnapshot({ status: "local" });
      return;
    }
    this.setSnapshot({ status: this.snapshot.health ? "offline" : "checking" });
  }

  private async refreshHealth() {
    const health = await pingBackend();
    this.snapshot.health = health;
    if (health?.status === "ok" && health.model_loaded) {
      this.snapshot.lastError = null;
    } else if (!health) {
      this.snapshot.lastError = "Backend unavailable";
    }
    this.recomputeStatus();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || typeof window === "undefined") return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectWs();
    }, RECONNECT_DELAY_MS);
  }

  private async connectWs() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const socket = new WebSocket(wsUrl());
      this.ws = socket;
      this.snapshot.wsState = socket.readyState;
      this.emitState();

      socket.onopen = () => {
        this.snapshot.wsState = socket.readyState;
        this.emitState();
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as RealtimeEnvelope;
          const name = parsed.event || parsed.type || parsed.name;
          const detail = parsed.data ?? parsed.payload ?? parsed;
          if (name && isRealtimeEventName(name)) {
            this.dispatchEvent(new CustomEvent(name, { detail }));
          }
        } catch {
          // Ignore malformed realtime payloads.
        }
      };

      socket.onerror = () => {
        this.snapshot.wsState = socket.readyState;
        this.snapshot.lastError = "Realtime connection error";
        this.emitState();
      };

      socket.onclose = () => {
        this.snapshot.wsState = socket.readyState;
        this.emitState();
        this.scheduleReconnect();
      };
    } catch {
      this.snapshot.wsState = null;
      this.snapshot.lastError = "Realtime connection error";
      this.emitState();
      this.scheduleReconnect();
    }
  }
}

export const backendConnection = new BackendConnectionManager();

export function backendStatusLabel(status: BackendConnectionStatus) {
  switch (status) {
    case "insightface":
      return "InsightFace Active";
    case "local":
      return "Local Mode";
    case "offline":
      return "Offline";
    default:
      return "Connecting";
  }
}

export function backendStatusTone(status: BackendConnectionStatus) {
  switch (status) {
    case "insightface":
      return "emerald";
    case "local":
      return "amber";
    case "offline":
      return "red";
    default:
      return "slate";
  }
}
