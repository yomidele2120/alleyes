import type { Match } from "@/hooks/use-face-recognition";

export function BoundingBox({
  m,
  gold,
  dim,
}: {
  m: Match;
  gold?: boolean;
  dim?: boolean;
}) {
  const known = m.identityId !== null;
  const opacity = dim ? 0.35 : 1;
  const borderColor = gold
    ? "var(--gold)"
    : known
    ? "var(--primary)"
    : "color-mix(in oklab, var(--muted-foreground) 80%, transparent)";

  return (
    <div
      className={`absolute rounded-lg border-2 transition-all ${gold ? "animate-gold-pulse" : ""}`}
      style={{
        left: m.box.x,
        top: m.box.y,
        width: m.box.width,
        height: m.box.height,
        borderColor,
        opacity,
        boxShadow: gold
          ? "0 0 20px color-mix(in oklab, var(--gold) 60%, transparent)"
          : known
          ? "0 0 14px color-mix(in oklab, var(--primary) 35%, transparent)"
          : "none",
      }}
    >
      <div
        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
        style={{
          background: gold
            ? "color-mix(in oklab, var(--gold) 85%, black)"
            : known
            ? "var(--primary)"
            : "color-mix(in oklab, var(--muted-foreground) 70%, black)",
          color: gold || known ? "var(--background)" : "var(--foreground)",
        }}
      >
        {m.label}
        {known && <span className="ml-1 opacity-80">{Math.round(m.confidence * 100)}%</span>}
      </div>
    </div>
  );
}
