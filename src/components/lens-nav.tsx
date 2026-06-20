import { Link, useRouterState } from "@tanstack/react-router";
import {
  Eye,
  Home,
  UserPlus,
  Crosshair,
  Server,
  ScrollText,
  Settings as SettingsIcon,
  Monitor,
  Users,
  LogOut,
  LogIn,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { backendStatusLabel, backendStatusTone } from "@/lib/lens-backend";
import { useBackendHealth } from "@/hooks/use-backend-health";

const ITEMS = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/live", label: "Live View", icon: Monitor },
  { to: "/search", label: "Search", icon: Crosshair },
  { to: "/identities", label: "Identities", icon: Users },
  { to: "/log", label: "Log", icon: ScrollText },
  { to: "/cameras", label: "Cameras", icon: Server },
  { to: "/enroll", label: "Enroll", icon: UserPlus },
  { to: "/identify", label: "Identify", icon: Eye },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function LensNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { status } = useBackendHealth();
  const label = backendStatusLabel(status);
  const tone = backendStatusTone(status);

  const toneClasses =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : tone === "red"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-border bg-background/40 text-muted-foreground";

  return (
    <>
      {/* Top brand bar */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="glass pointer-events-auto mx-auto mt-3 flex max-w-7xl items-center justify-between rounded-2xl px-4 py-2.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" strokeWidth={1.5} />
            <span className="font-display text-xl tracking-[0.3em]">LENS</span>
          </Link>
          {/* Desktop inline nav */}
          <nav className="hidden md:flex items-center gap-4">
            {ITEMS.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`text-[11px] uppercase tracking-[0.2em] transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 md:gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.16em] md:px-2.5 md:py-1 md:text-[10px] md:tracking-[0.2em] ${toneClasses}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background:
                    tone === "emerald"
                      ? "#22C55E"
                      : tone === "amber"
                        ? "#F59E0B"
                        : tone === "red"
                          ? "#EF4444"
                          : "var(--muted-foreground)",
                  boxShadow:
                    tone === "emerald"
                      ? "0 0 8px #22C55E"
                      : tone === "amber"
                        ? "0 0 8px #F59E0B"
                        : tone === "red"
                          ? "0 0 8px #EF4444"
                          : "none",
                }}
              />
              {label}
            </span>
            {user ? (
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-primary"
              >
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            )}
          </div>
        </div>
        {status === "local" && (
          <div className="pointer-events-auto mx-auto mt-2 flex max-w-7xl items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-amber-300">
            Running in Local Mode
          </div>
        )}
      </header>

      {/* Mobile bottom nav (compact, scrolls horizontally) */}
      <nav className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 md:hidden max-w-[96vw]">
        <div className="glass flex items-center gap-1 overflow-x-auto rounded-2xl px-2 py-2 no-scrollbar">
          {ITEMS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 transition-colors flex-shrink-0 ${
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="text-[9px] uppercase tracking-[0.12em]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
