import { Link, useRouterState } from "@tanstack/react-router";
import {
  Eye,
  Home,
  UserPlus,
  Crosshair,
  Server,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";

const ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/enroll", label: "Enroll", icon: UserPlus },
  { to: "/identify", label: "Identify", icon: Eye },
  { to: "/search", label: "Search", icon: Crosshair },
  { to: "/network", label: "Network", icon: Server },
  { to: "/log", label: "Log", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function LensNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <>
      {/* Top brand bar */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="glass pointer-events-auto mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span className="font-display text-xl tracking-[0.3em]">LENS</span>
          </Link>
          {/* Desktop inline nav */}
          <nav className="hidden md:flex items-center gap-5">
            {ITEMS.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`text-[11px] uppercase tracking-[0.22em] transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 md:hidden">
        <div className="glass flex items-center gap-1 rounded-2xl px-2 py-2">
          {ITEMS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-colors ${
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="text-[9px] uppercase tracking-[0.15em]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
