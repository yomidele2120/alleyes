import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Eye, UserPlus, Crosshair } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const FEATURES = [
  { to: "/identify", label: "Identify", icon: Eye },
  { to: "/enroll", label: "Enroll", icon: UserPlus },
  { to: "/search", label: "Search", icon: Crosshair },
] as const;

/**
 * Quick switcher between camera-based features (Identify, Enroll, Search).
 * Rendered inside the immersive top bar.
 */
export function FeatureSwitcher() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = FEATURES.find((f) => path.startsWith(f.to)) ?? FEATURES[0];

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-foreground backdrop-blur transition-colors hover:bg-white/20"
        aria-label="Switch feature"
      >
        <current.icon className="h-3.5 w-3.5" />
        <span>{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[10rem] overflow-hidden rounded-xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur">
          {FEATURES.map((f) => {
            const active = f.to === current.to;
            return (
              <Link
                key={f.to}
                to={f.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 text-[11px] uppercase tracking-[0.25em] transition-colors ${
                  active ? "bg-primary/20 text-primary" : "text-foreground hover:bg-white/10"
                }`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
