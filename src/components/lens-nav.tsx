import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  IdCard,
  ShieldAlert,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { backendStatusLabel, backendStatusTone } from "@/lib/lens-backend";
import { useBackendHealth } from "@/hooks/use-backend-health";

// Main features (shown in top nav + mobile bottom nav)
const MAIN = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/live", label: "Live", icon: Monitor },
  { to: "/identify", label: "Identify", icon: Eye },
  { to: "/search", label: "Search", icon: Crosshair },
] as const;

// Services (grouped under a dropdown)
const SERVICES = [
  { to: "/kyc", label: "KYC · Identity", icon: IdCard, desc: "NIN / BVN lookup" },
  { to: "/aml", label: "AML · Screening", icon: ShieldAlert, desc: "Sanctions & PEP" },
  { to: "/enroll", label: "Enroll Face", icon: UserPlus, desc: "Register identities" },
  { to: "/identities", label: "Identities", icon: Users, desc: "Enrolled roster" },
  { to: "/cameras", label: "Cameras", icon: Server, desc: "Feeds & devices" },
  { to: "/log", label: "Detection Log", icon: ScrollText, desc: "Recent hits" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, desc: "Preferences" },
] as const;

export function LensNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { status } = useBackendHealth();
  const label = backendStatusLabel(status);
  const tone = backendStatusTone(status);
  const [openServices, setOpenServices] = useState(false);
  const [openMobileSvc, setOpenMobileSvc] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setOpenServices(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    setOpenServices(false);
    setOpenMobileSvc(false);
  }, [pathname]);

  const toneClasses =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : tone === "red"
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-border bg-background/40 text-muted-foreground";

  const servicesActive = SERVICES.some((s) => s.to === pathname);

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
            {MAIN.map(({ to, label }) => {
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
            <div className="relative" ref={ddRef}>
              <button
                onClick={() => setOpenServices((v) => !v)}
                className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  servicesActive || openServices
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-haspopup="menu"
                aria-expanded={openServices}
              >
                Services
                <ChevronDown className={`h-3 w-3 transition-transform ${openServices ? "rotate-180" : ""}`} />
              </button>
              {openServices && (
                <div className="glass absolute right-0 top-full mt-2 w-72 rounded-2xl p-2 shadow-2xl">
                  {SERVICES.map(({ to, label, icon: Icon, desc }) => {
                    const active = pathname === to;
                    return (
                      <Link
                        key={to}
                        to={to}
                        className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                          active ? "bg-primary/15" : "hover:bg-background/60"
                        }`}
                      >
                        <span className="mt-0.5 rounded-lg border border-border bg-background/60 p-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={1.6} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[11px] uppercase tracking-[0.18em] text-foreground">
                            {label}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">{desc}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
                <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-primary"
              >
                <LogIn className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign in</span>
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

      {/* Mobile services sheet */}
      {openMobileSvc && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
          onClick={() => setOpenMobileSvc(false)}
        >
          <div
            className="glass absolute bottom-20 left-1/2 w-[92vw] max-w-md -translate-x-1/2 rounded-2xl p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Services
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map(({ to, label, icon: Icon, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex flex-col gap-1 rounded-xl border border-border bg-card/60 p-3"
                >
                  <Icon className="h-4 w-4 text-primary" strokeWidth={1.6} />
                  <span className="mt-1 text-[11px] uppercase tracking-[0.14em]">{label}</span>
                  <span className="text-[10px] text-muted-foreground">{desc}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav — 4 main + services trigger */}
      <nav className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 md:hidden max-w-[96vw]">
        <div className="glass flex items-center gap-1 rounded-2xl px-2 py-2">
          {MAIN.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`}
                aria-label={label}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="text-[9px] uppercase tracking-[0.12em]">{label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpenMobileSvc((v) => !v)}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-colors ${
              servicesActive || openMobileSvc ? "bg-primary/15 text-primary" : "text-muted-foreground"
            }`}
            aria-label="Services"
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.6} />
            <span className="text-[9px] uppercase tracking-[0.12em]">Services</span>
          </button>
        </div>
      </nav>
    </>
  );
}
