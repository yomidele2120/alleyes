import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useMemo } from "react";
import type { Identity } from "@/lib/face-store";
import type { Match } from "@/hooks/use-face-recognition";
import { emotionEmoji } from "@/lib/utils-misc";
import { recentSightings } from "@/lib/detection-log";

export function FaceIntelPanel({
  identity,
  match,
  feedName,
  onClose,
}: {
  identity: Identity;
  match?: Match;
  feedName?: string;
  onClose: () => void;
}) {
  const sightings = useMemo(() => recentSightings(identity.id, 8), [identity.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm">
      <div className="glass animate-fade-in max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-6 sm:mb-6 sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {identity.thumbnails[0] ? (
              <img
                src={identity.thumbnails[0]}
                alt={identity.name}
                className="h-14 w-14 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 font-display text-xl text-primary">
                {identity.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-display text-2xl tracking-[0.1em]">{identity.name}</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {identity.group || "Unassigned"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat label="Detections" value={String(identity.detectionCount)} />
          <Stat
            label="Last Seen"
            value={
              identity.lastSeen
                ? new Date(identity.lastSeen).toLocaleString()
                : "Never"
            }
          />
          <Stat
            label="First Enrolled"
            value={new Date(identity.firstEnrolled).toLocaleDateString()}
          />
          <Stat label="Current Feed" value={feedName || "—"} />
          {match?.age != null && <Stat label="Est. Age" value={`~${Math.round(match.age)}`} />}
          {match?.expression && (
            <Stat label="Emotion" value={`${emotionEmoji(match.expression)} ${match.expression}`} />
          )}
        </div>

        {sightings.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Previous Sightings · {sightings.length}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {sightings.map((s) => (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-lg border border-border bg-card/60"
                  title={`${s.feed} — ${new Date(s.time).toLocaleString()}`}
                >
                  {s.thumbnail ? (
                    <img
                      src={s.thumbnail}
                      alt=""
                      className="h-16 w-full object-cover"
                    />
                  ) : (
                    <div className="h-16 w-full bg-muted" />
                  )}
                  <div className="px-1.5 py-1">
                    <p className="truncate text-[9px] uppercase tracking-[0.18em]">
                      {s.feed}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {new Date(s.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/profile/$id"
          params={{ id: identity.id }}
          className="glow-hover mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          View Full Profile
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3">
      <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm">{value}</p>
    </div>
  );
}
