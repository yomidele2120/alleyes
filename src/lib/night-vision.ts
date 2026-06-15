// Night-vision frame enhancement utilities.
// Pure functions — no React. Used by useNightMode hook.

export type LightLevel = "well_lit" | "dim" | "low" | "night";

export type NightPreset = {
  gamma: number;
  brightness: number; // 0..255 additive
  contrast: number; // 1.0 = no change
};

export type NightMode = "auto" | "on" | "off";

export const PRESETS: Record<LightLevel, NightPreset> = {
  well_lit: { gamma: 1.0, brightness: 0, contrast: 1.2 },
  dim: { gamma: 0.7, brightness: 40, contrast: 1.4 },
  low: { gamma: 0.5, brightness: 70, contrast: 1.6 },
  night: { gamma: 0.35, brightness: 100, contrast: 2.0 },
};

export const LEVEL_LABEL: Record<LightLevel, string> = {
  well_lit: "WELL LIT",
  dim: "DIM",
  low: "LOW LIGHT",
  night: "NIGHT MODE",
};

export const LEVEL_COLOR: Record<LightLevel, string> = {
  well_lit: "#22C55E",
  dim: "#FACC15",
  low: "#F97316",
  night: "#EF4444",
};

export function levelFromBrightness(avg: number): LightLevel {
  if (avg >= 180) return "well_lit";
  if (avg >= 100) return "dim";
  if (avg >= 50) return "low";
  return "night";
}

/** Samples ~1000 random pixels for a fast average brightness. 0..255. */
export function getAverageBrightness(data: Uint8ClampedArray): number {
  let total = 0;
  const px = data.length / 4;
  const samples = Math.min(1000, px);
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor(Math.random() * px) * 4;
    total += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  }
  return total / samples;
}

// Precomputed gamma LUTs cache (keyed by gamma * 100).
const gammaCache = new Map<number, Uint8Array>();
function gammaLut(gamma: number): Uint8Array {
  const key = Math.round(gamma * 100);
  let lut = gammaCache.get(key);
  if (!lut) {
    lut = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.min(255, Math.max(0, Math.round(255 * Math.pow(i / 255, gamma))));
    }
    gammaCache.set(key, lut);
  }
  return lut;
}

/** Mutates the imageData buffer in place with gamma + brightness + contrast. */
export function enhanceFrame(
  data: Uint8ClampedArray,
  preset: NightPreset,
  greenTint = false,
) {
  const lut = gammaLut(preset.gamma);
  const factor = preset.contrast;
  const b = preset.brightness;
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]];
    let g = lut[data[i + 1]];
    let bl = lut[data[i + 2]];
    if (b !== 0) {
      r = r + b; if (r > 255) r = 255;
      g = g + b; if (g > 255) g = 255;
      bl = bl + b; if (bl > 255) bl = 255;
    }
    if (factor !== 1) {
      r = factor * (r - 128) + 128; if (r > 255) r = 255; else if (r < 0) r = 0;
      g = factor * (g - 128) + 128; if (g > 255) g = 255; else if (g < 0) g = 0;
      bl = factor * (bl - 128) + 128; if (bl > 255) bl = 255; else if (bl < 0) bl = 0;
    }
    if (greenTint) {
      // Subtle phosphor-green tint — pull r/b down a touch, push g up.
      r = r * 0.85;
      bl = bl * 0.85;
      g = Math.min(255, g + 12);
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = bl;
  }
}

/** Combine preset + user manual floors. */
export function effectivePreset(
  base: NightPreset,
  manualBrightnessBoost: number,
  manualContrastBoost: number,
): NightPreset {
  return {
    gamma: base.gamma,
    brightness: Math.max(base.brightness, manualBrightnessBoost),
    contrast: Math.max(base.contrast, manualContrastBoost),
  };
}
