// Lightweight settings store with cross-tab + same-tab change events.
import { useEffect, useState } from "react";

export type Settings = {
  confidenceThreshold: number; // 0.3–0.8 (face-api distance is inverted, see use-face-recognition)
  showAge: boolean;
  showEmotion: boolean;
  showGender: boolean;
  soundAlerts: boolean;
  autoSnapshot: boolean;
  showUnknown: boolean;
  pinLockEnabled: boolean;
  pinHash: string | null;
  // Night vision
  nightModeOverride: "auto" | "on" | "off";
  autoNightMode: boolean;
  manualBrightnessBoost: number; // 0..100 (additive floor)
  manualContrastBoost: number; // 1.0..2.5 (floor)
  greenTint: boolean;
  // LENS v3 — backend & recognition
  backendUrl: string;
  mediamtxUrl: string;
  wsUrl: string;
  similarityThreshold: number; // 0.35–0.60 (cosine — higher = stricter)
  fpsRate: number; // 1..5
  showAgeEstimate: boolean;
  showGenderEstimate: boolean;
  soundOnTarget: boolean;
  soundOnWatchlist: boolean;
  desktopNotifications: boolean;
};

const KEY = "lens.settings.v1";

export const defaultSettings: Settings = {
  confidenceThreshold: 0.58,
  showAge: true,
  showEmotion: true,
  showGender: false,
  soundAlerts: true,
  autoSnapshot: true,
  showUnknown: true,
  pinLockEnabled: false,
  pinHash: null,
  nightModeOverride: "auto",
  autoNightMode: true,
  manualBrightnessBoost: 0,
  manualContrastBoost: 1.0,
  greenTint: false,
  backendUrl: "https://lenzbackend-production.up.railway.app",
  mediamtxUrl: "http://localhost:8888",
  wsUrl: "wss://lenzbackend-production.up.railway.app/ws",
  similarityThreshold: 0.45,
  fpsRate: 2,
  showAgeEstimate: true,
  showGenderEstimate: true,
  soundOnTarget: true,
  soundOnWatchlist: true,
  desktopNotifications: false,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...(JSON.parse(raw) as Settings) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("lens:settings"));
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(() => loadSettings());
  useEffect(() => {
    const sync = () => setS(loadSettings());
    window.addEventListener("lens:settings", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lens:settings", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = (patch: Partial<Settings>) => {
    const next = { ...loadSettings(), ...patch };
    saveSettings(next);
    setS(next);
  };
  return [s, update];
}

// SHA-256 hex digest for the PIN — local-only screen guard, not real security.
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
