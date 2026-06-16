import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  active?: boolean;
  gold?: boolean;
  night?: boolean;
  className?: string;
  style?: CSSProperties;
};

// Camera viewport with corner brackets + optional scan-line / glow states.
export function CameraFrame({ children, active, gold, night, className = "", style }: Props) {
  const cornerStyle = night
    ? { borderColor: "#00FF88" }
    : undefined;
  const cornerColor = gold
    ? "border-gold"
    : night
    ? ""
    : active
    ? "border-primary"
    : "border-border";
  const glow = gold
    ? "animate-gold-pulse"
    : active && !night
    ? "animate-border-pulse"
    : "";
  const wrapperStyle = night
    ? {
        boxShadow:
          "0 0 24px color-mix(in oklab, #00FF88 40%, transparent), inset 0 0 30px color-mix(in oklab, #00FF88 10%, transparent)",
      }
    : undefined;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-black/60 ${glow} ${className}`}
      style={{
        borderColor: night ? "color-mix(in oklab, #00FF88 50%, transparent)" : undefined,
        ...wrapperStyle,
      }}
    >
      {children}

      {/* Corner brackets */}
      {(
        [
          "top-3 left-3 border-t-2 border-l-2 rounded-tl-lg",
          "top-3 right-3 border-t-2 border-r-2 rounded-tr-lg",
          "bottom-3 left-3 border-b-2 border-l-2 rounded-bl-lg",
          "bottom-3 right-3 border-b-2 border-r-2 rounded-br-lg",
        ] as const
      ).map((pos, i) => (
        <span
          key={i}
          className={`pointer-events-none absolute h-6 w-6 transition-colors ${cornerColor} ${pos}`}
          style={cornerStyle}
        />
      ))}

      {/* Scan line when active */}
      {active && !gold && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-visible">
          <div
            className="animate-scan-line h-px w-full"
            style={{
              background: night
                ? "linear-gradient(90deg, transparent, #00FF88, transparent)"
                : "linear-gradient(90deg, transparent, var(--primary), transparent)",
              boxShadow: night
                ? "0 0 12px 2px #00FF88"
                : "0 0 12px 2px var(--primary)",
            }}
          />
        </div>
      )}
    </div>
  );
}
