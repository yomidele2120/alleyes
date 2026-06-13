import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  active?: boolean;
  gold?: boolean;
  className?: string;
};

// Camera viewport with corner brackets + optional scan-line / glow states.
export function CameraFrame({ children, active, gold, className = "" }: Props) {
  const cornerColor = gold ? "border-gold" : active ? "border-primary" : "border-border";
  const glow = gold
    ? "animate-gold-pulse"
    : active
    ? "animate-border-pulse"
    : "";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-black/60 ${glow} ${className}`}
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
        />
      ))}

      {/* Scan line when active */}
      {active && !gold && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-visible">
          <div className="animate-scan-line h-px w-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_2px] shadow-primary" />
        </div>
      )}
    </div>
  );
}
