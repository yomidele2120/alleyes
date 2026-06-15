import type { Match } from "@/hooks/use-face-recognition";
import { emotionEmoji } from "@/lib/utils-misc";
import { loadSettings } from "@/lib/settings-store";

type Props = {
  m: Match;
  /** override color for this box (target color) */
  color?: string;
  /** dim non-targets */
  dim?: boolean;
  /** treat this as a search target — gold-style glow */
  target?: boolean;
  onClick?: () => void;
};

export function BoundingBox({ m, color, dim, target, onClick }: Props) {
  const s = loadSettings();
  if (!m.identityId && !s.showUnknown) return null;

  const night = s.nightModeOverride === "on";
  const known = m.identityId !== null;
  const opacity = dim ? 0.35 : 1;
  const accent =
    color ??
    (target
      ? "var(--gold)"
      : night && known
      ? "#00FF88"
      : known
      ? "var(--primary)"
      : "color-mix(in oklab, var(--muted-foreground) 80%, transparent)");

  const chips: string[] = [];
  if (m.age != null && s.showAge) chips.push(`~${Math.round(m.age)}`);
  if (m.gender && s.showGender) chips.push(m.gender);
  const emoji = m.expression && s.showEmotion ? emotionEmoji(m.expression) : "";

  const labelBg = target
    ? "color-mix(in oklab, var(--gold) 90%, black)"
    : night && known
    ? "#003D22"
    : known
    ? accent
    : "color-mix(in oklab, var(--muted-foreground) 70%, black)";
  const labelColor = night && known
    ? "#FFFFFF"
    : target || known
    ? "var(--background)"
    : "var(--foreground)";

  return (
    <div
      onClick={onClick}
      className={`absolute rounded-lg border-2 ${target ? "animate-gold-pulse" : ""} ${
        onClick ? "pointer-events-auto cursor-pointer" : ""
      }`}
      style={{
        left: m.box.x,
        top: m.box.y,
        width: m.box.width,
        height: m.box.height,
        borderColor: accent,
        opacity,
        boxShadow: target
          ? "0 0 20px color-mix(in oklab, var(--gold) 60%, transparent)"
          : known
          ? `0 0 14px color-mix(in oklab, ${accent} 35%, transparent)`
          : "none",
        transition: "left 120ms linear, top 120ms linear, width 120ms linear, height 120ms linear",
      }}
    >
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{ background: labelBg, color: labelColor }}
      >
        {emoji && <span className="mr-1">{emoji}</span>}
        {m.label}
        {known && <span className="ml-1 opacity-80">{Math.round(m.confidence * 100)}%</span>}
      </div>
      {chips.length > 0 && (
        <div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1 whitespace-nowrap"
        >
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground backdrop-blur"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
