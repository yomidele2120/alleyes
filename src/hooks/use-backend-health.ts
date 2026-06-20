import { useSyncExternalStore } from "react";
import { backendConnection, type BackendConnectionStatus, type BackendHealth } from "@/lib/lens-backend";

export function useBackendHealth() {
  backendConnection.ensureStarted();
  const snapshot = useSyncExternalStore(
    (listener) => backendConnection.subscribe(listener),
    () => backendConnection.getSnapshot(),
    () => backendConnection.getSnapshot(),
  );

  return {
    health: snapshot.health,
    status: snapshot.status as BackendConnectionStatus,
    online: snapshot.status === "insightface",
    localMode: snapshot.status === "local",
    offline: snapshot.status === "offline",
    checking: snapshot.status === "checking",
    wsState: snapshot.wsState,
    lastError: snapshot.lastError,
  };
}
