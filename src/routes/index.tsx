import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Crosshair, Eye, UserPlus } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { loadIdentities } from "@/lib/face-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LENS — Identify. Enroll. Locate." },
      {
        name: "description",
        content:
          "Private, on-device face recognition. Enroll identities and identify them live — nothing leaves your browser.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [count, setCount] = useState(0);
  useEffect(() => setCount(loadIdentities().length), []);

  return (
    <div className="relative min-h-screen overflow-hidden mesh-bg">
      <div className="absolute inset-0 grid-overlay opacity-40" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <LensNav />

      <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 pt-28 text-center">
        <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px] shadow-primary" />
          On-device intelligence
        </div>

        <h1 className="animate-fade-in mt-8 font-display text-6xl tracking-[0.35em] sm:text-8xl">
          LENS
        </h1>
        <p className="animate-fade-in mt-4 text-sm uppercase tracking-[0.4em] text-muted-foreground sm:text-base">
          Identify · Enroll · Locate
        </p>

        <p className="animate-fade-in mt-8 max-w-md text-sm text-muted-foreground/90 sm:text-base">
          A precision instrument for recognizing the faces you choose to remember.
          Every computation happens inside your browser.
        </p>

        <div className="animate-fade-in mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/enroll"
            className="glow-hover group inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium tracking-wide text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            Enroll a Face
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/identify"
            className="glow-hover inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-medium tracking-wide text-foreground"
          >
            <Eye className="h-4 w-4" strokeWidth={1.8} />
            Identify
          </Link>
          <Link
            to="/find"
            className="glow-hover inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-medium tracking-wide text-foreground"
          >
            <Crosshair className="h-4 w-4" strokeWidth={1.8} />
            Find Mode
          </Link>
        </div>

        <div className="animate-fade-in mt-10 inline-flex items-center gap-3 rounded-full border border-border bg-card/40 px-4 py-1.5 text-xs tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          {count} {count === 1 ? "identity" : "identities"} stored
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/50 py-6 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        All processing happens on your device. No data is sent anywhere.
      </footer>
    </div>
  );
}
