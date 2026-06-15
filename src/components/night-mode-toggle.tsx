import { Moon } from "lucide-react";
import type { NightMode } from "@/lib/night-vision";
import { LEVEL_COLOR, LEVEL_LABEL, type LightLevel } from "@/lib/night-vision";

const MODE_LABEL: Record<NightMode, string> = {
  auto: "AUTO",
  on: "NIGHT ON",
  off: "NIGHT OFF",
};

export function NightModeToggle({
  mode,
  onCycle,
  lightLevel,
}: {
  mode: NightMode;
  onCycle: () => void;
  lightLevel: LightLevel;
}) {
  const isNight = mode === "on";
  return (
    <div className="flex items-center gap-2">
      <div
        className="glass hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] sm:flex"
        title="Detected light level"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: LEVEL_COLOR[lightLevel],
            boxShadow: `0 0 8px ${LEVEL_COLOR[lightLevel]}`,
          }}
        />
        <span className="text-muted-foreground">{LEVEL_LABEL[lightLevel]}</span>
      </div>
      <button
        onClick={onCycle}
        className="glass glow-hover inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[10px] uppercase tracking-[0.22em]"
        style={
          isNight
            ? { borderColor: "#00FF88", color: "#00FF88" }
            : undefined
        }
        aria-label={`Night mode ${MODE_LABEL[mode]}`}
      >
        <Moon
          className="h-3.5 w-3.5"
          style={isNight ? { color: "#00FF88" } : undefined}
        />
        {MODE_LABEL[mode]}
      </button>
    </div>
  );
}

export function NightActivePill() {
  return (
    <div
      className="glass pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em]"
      style={{
        color: "#00FF88",
        borderColor: "color-mix(in oklab, #00FF88 50%, transparent)",
      }}
    >
      ● Night Vision Active
    </div>
  );
}
