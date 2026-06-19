import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

export function SignInGate({ feature }: { feature: string }) {
  return (
    <div className="relative min-h-screen mesh-bg pb-28 pt-24">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <div className="relative mx-auto max-w-md px-5">
        <div className="glass rounded-2xl p-8 text-center">
          <h1 className="font-display text-3xl tracking-[0.2em]">Sign in required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {feature} is backed by Lovable Cloud. Sign in to store identities, camera feeds and
            detection history securely.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <LogIn className="h-4 w-4" /> Sign in to continue
          </Link>
        </div>
      </div>
    </div>
  );
}
