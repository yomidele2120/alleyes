import { Link, useRouterState } from "@tanstack/react-router";
import { Eye } from "lucide-react";

export function LensNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const link = (to: string, label: string) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={`text-xs uppercase tracking-[0.18em] transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
      </Link>
    );
  };
  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      <div className="glass mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-2xl px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <span className="font-display text-xl tracking-[0.3em]">LENS</span>
        </Link>
        <nav className="flex items-center gap-5">
          {link("/enroll", "Enroll")}
          {link("/identify", "Identify")}
          {link("/find", "Find")}
        </nav>
      </div>
    </header>
  );
}
