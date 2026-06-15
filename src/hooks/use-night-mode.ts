import { useEffect, useRef, useState } from "react";
import {
  effectivePreset,
  enhanceFrame,
  getAverageBrightness,
  levelFromBrightness,
  PRESETS,
  type LightLevel,
  type NightMode,
} from "@/lib/night-vision";
import { useSettings } from "@/lib/settings-store";

const TARGET_FPS = 15;
const FRAME_MS = 1000 / TARGET_FPS;
const SAMPLE_EVERY_MS = 2000;
const MAX_W = 720;

/**
 * Drives a <canvas> from a <video>, optionally applying night-vision pixel
 * enhancement. Sample brightness every 2s and auto-pick an enhancement preset.
 * Returns the canvas ref to render and use as the face-api detection source.
 */
export function useNightMode(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [settings, updateSettings] = useSettings();
  const [lightLevel, setLightLevel] = useState<LightLevel>("well_lit");

  const mode: NightMode = settings.nightModeOverride;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const levelRef = useRef(lightLevel);
  levelRef.current = lightLevel;
  const activeRef = useRef(false);

  const cycleMode = () => {
    const next: NightMode =
      mode === "auto" ? "on" : mode === "on" ? "off" : "auto";
    updateSettings({ nightModeOverride: next });
  };

  // Whether the canvas is currently applying enhancement.
  const [active, setActive] = useState(false);

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let lastSample = 0;
    let lastFrame = 0;

    const loop = (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (t - lastFrame < FRAME_MS) return;
      lastFrame = t;

      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2 || v.videoWidth === 0) return;

      // Lazy-size canvas to a sane processing resolution.
      if (c.width === 0 || c.width > MAX_W * 2) {
        const scale = Math.min(1, MAX_W / v.videoWidth);
        c.width = Math.round(v.videoWidth * scale);
        c.height = Math.round(v.videoHeight * scale);
      }
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(v, 0, 0, c.width, c.height);

      const s = settingsRef.current;
      const m = modeRef.current;

      // Determine whether to enhance this frame.
      let shouldEnhance = false;
      let level = levelRef.current;
      if (m === "on") {
        shouldEnhance = true;
        level = "night";
      } else if (m === "auto" && s.autoNightMode) {
        shouldEnhance = level !== "well_lit";
      }

      if (shouldEnhance || t - lastSample > SAMPLE_EVERY_MS) {
        // Need pixel data either for enhancement or for brightness sampling.
        let imageData: ImageData;
        try {
          imageData = ctx.getImageData(0, 0, c.width, c.height);
        } catch {
          return; // tainted canvas (cross-origin) — skip
        }

        if (t - lastSample > SAMPLE_EVERY_MS) {
          lastSample = t;
          const avg = getAverageBrightness(imageData.data);
          const next = levelFromBrightness(avg);
          if (next !== levelRef.current) {
            setLightLevel(next);
            level = next;
          }
        }

        if (shouldEnhance) {
          const base = PRESETS[m === "on" ? "night" : level];
          const preset = effectivePreset(
            base,
            s.manualBrightnessBoost,
            s.manualContrastBoost,
          );
          enhanceFrame(imageData.data, preset, s.greenTint || m === "on");
          ctx.putImageData(imageData, 0, 0);
        }
      }

      const isActive = shouldEnhance;
      // setState only on change to avoid render thrash.
      if (isActive !== activeRef.current) {
        activeRef.current = isActive;
        setActive(isActive);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [videoRef]);

  return { canvasRef, mode, cycleMode, lightLevel, active };
}
