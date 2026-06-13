import { useState } from "react";
import { Camera } from "lucide-react";

// Shows a styled "Continue" prompt so getUserMedia is invoked from a user
// gesture (required by mobile browsers). Mounts children only after consent.
export function CameraGate({ children }: { children: React.ReactNode }) {
  const [granted, setGranted] = useState(false);

  if (granted) return <>{children}</>;

  return (
    <div className="glass animate-fade-in mx-auto mt-10 max-w-md rounded-2xl p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Camera className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <p className="mt-5 font-display text-2xl tracking-[0.15em]">Camera Access</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        LENS needs camera access to function. Tap Continue to allow.
      </p>
      <button
        onClick={() => setGranted(true)}
        className="glow-hover mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
      >
        Continue
      </button>
    </div>
  );
}
