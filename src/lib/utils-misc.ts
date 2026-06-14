// Misc UI helpers.

export const TARGET_PALETTE = [
  { name: "Gold", value: "#C9A84C", cssVar: "var(--gold)" },
  { name: "Blue", value: "#4F8EF7", cssVar: "var(--primary)" },
  { name: "Green", value: "#22C55E", cssVar: "#22C55E" },
  { name: "Red", value: "#EF4444", cssVar: "#EF4444" },
  { name: "Purple", value: "#A855F7", cssVar: "#A855F7" },
  { name: "Cyan", value: "#06B6D4", cssVar: "#06B6D4" },
];

export function targetColor(index: number): string {
  return TARGET_PALETTE[index % TARGET_PALETTE.length].value;
}

const EMOJI: Record<string, string> = {
  happy: "😊",
  sad: "😢",
  angry: "😠",
  surprised: "😮",
  fearful: "😨",
  disgusted: "🤢",
  neutral: "😐",
};

export function emotionEmoji(e?: string | null) {
  return e ? EMOJI[e] ?? "" : "";
}

/** Capture a small thumbnail dataURL from a video element. */
export function snapshotVideo(video: HTMLVideoElement, size = 96): string {
  try {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const vw = video.videoWidth || size;
    const vh = video.videoHeight || size;
    const s = Math.min(vw, vh);
    ctx.drawImage(video, (vw - s) / 2, (vh - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  }
}

let audioCtx: AudioContext | null = null;
export function chime() {
  try {
    if (typeof window === "undefined") return;
    audioCtx = audioCtx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    o.type = "sine";
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    // best-effort
  }
}
