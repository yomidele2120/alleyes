import { useEffect, useState } from "react";
import { pingBackend, type BackendHealth } from "@/lib/lens-backend";

export function useBackendHealth(intervalMs = 15000) {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    let ac: AbortController | null = null;
    const tick = async () => {
      ac = new AbortController();
      const h = await pingBackend(ac.signal);
      if (!mounted) return;
      setHealth(h);
      setChecking(false);
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      mounted = false;
      ac?.abort();
      clearInterval(id);
    };
  }, [intervalMs]);

  return { health, online: !!health, checking };
}
