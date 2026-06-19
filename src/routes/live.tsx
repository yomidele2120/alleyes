import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LensNav } from "@/components/lens-nav";
import { CameraTile } from "@/components/camera-tile";
import { SignInGate } from "@/components/sign-in-gate";
import { useSession } from "@/hooks/use-session";
import { useBackendHealth } from "@/hooks/use-backend-health";
import { listCameras } from "@/lib/cloud/cameras";
import { hlsUrlFor } from "@/lib/lens-backend";
import { Activity, Cpu, Radio, Users } from "lucide-react";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live View — LENS" },
      { name: "description", content: "Live multi-camera face recognition grid." },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { user, loading } = useSession();
  const { health, online } = useBackendHealth();
  const camerasQuery = useQuery({
    queryKey: ["cameras"],
    queryFn: listCameras,
    enabled: !!user,
  });

  if (loading) return null;
  if (!user) return <SignInGate feature="Live View" />;

  const cameras = (camerasQuery.data ?? []).filter((c) => c.is_active);
  const cols =
    cameras.length <= 1 ? "grid-cols-1" : cameras.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  return (
    <div className="relative min-h-screen mesh-bg pb-28 md:pb-10 pt-24">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <LensNav />
      <main className="relative mx-auto max-w-7xl px-5">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Operations</p>
            <h1 className="font-display text-3xl tracking-[0.2em]">Live View</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
            <StatusPill icon={Cpu} label={online ? "Engine: Backend" : "Engine: Client"} ok={online} />
            <StatusPill icon={Radio} label={`Streams ${cameras.length}`} ok={cameras.length > 0} />
            {health && (
              <StatusPill icon={Users} label={`${health.identity_count} stored`} ok />
            )}
          </div>
        </header>

        {cameras.length === 0 ? (
          <EmptyCameras />
        ) : (
          <div className={`grid gap-4 ${cols}`}>
            {cameras.map((c) => (
              <CameraTile
                key={c.id}
                name={c.name}
                location={c.location}
                hlsUrl={c.stream_url || hlsUrlFor(c.rtmp_key)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  ok,
}: {
  icon: typeof Activity;
  label: string;
  ok: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${
        ok ? "border-emerald-500/40 text-emerald-400" : "border-border text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function EmptyCameras() {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <Radio className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-display text-xl tracking-[0.15em]">No cameras configured</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Add a camera, then push an RTMP stream to it from any IP camera, phone, or OBS.
      </p>
      <a
        href="/cameras"
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Add a camera
      </a>
    </div>
  );
}
