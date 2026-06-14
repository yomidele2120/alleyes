import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import {
  loadIdentities,
  removeIdentity,
  updateIdentity,
  type Identity,
} from "@/lib/face-store";
import { loadLog } from "@/lib/detection-log";

export const Route = createFileRoute("/profile/$id")({
  head: () => ({
    meta: [
      { title: "Profile · LENS" },
      { name: "description", content: "Identity profile, sightings, group and notes." },
    ],
  }),
  component: ProfilePage,
});

const GROUPS = ["", "Family", "Team", "Watch List"];

function ProfilePage() {
  const { id } = useParams({ from: "/profile/$id" });
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [customGroup, setCustomGroup] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const i = loadIdentities().find((x) => x.id === id) ?? null;
    setIdentity(i);
    if (i) {
      setName(i.name);
      if (GROUPS.includes(i.group)) {
        setGroup(i.group);
        setCustomGroup("");
      } else {
        setGroup("__custom");
        setCustomGroup(i.group);
      }
      setNotes(i.notes);
    }
  }, [id]);

  const sightings = useMemo(
    () => loadLog().filter((l) => l.identityId === id).slice(0, 10),
    [id],
  );

  if (!identity) {
    return (
      <div className="min-h-screen bg-background pb-28 md:pb-10">
        <LensNav />
        <main className="mx-auto max-w-2xl px-4 pt-24 text-center">
          <p className="text-sm text-muted-foreground">Identity not found.</p>
          <Link
            to="/enroll"
            className="mt-4 inline-flex items-center gap-1 text-primary"
          >
            Go to Enroll
          </Link>
        </main>
      </div>
    );
  }

  const onSave = () => {
    updateIdentity(identity.id, {
      name: name.trim() || identity.name,
      group: group === "__custom" ? customGroup.trim() : group,
      notes,
    });
    toast.success("Profile saved");
  };

  const onDelete = () => {
    if (!confirm(`Delete ${identity.name}? This cannot be undone.`)) return;
    removeIdentity(identity.id);
    toast("Identity removed");
    history.back();
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-10">
      <LensNav />
      <main className="mx-auto max-w-2xl px-4 pt-24">
        <button
          onClick={() => history.back()}
          className="mb-3 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <header className="animate-fade-in mb-6 flex items-center gap-4">
          {identity.thumbnails[0] ? (
            <img
              src={identity.thumbnails[0]}
              alt={identity.name}
              className="h-20 w-20 rounded-2xl border border-border object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 font-display text-3xl text-primary">
              {identity.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl tracking-[0.15em]">{identity.name}</h1>
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              {identity.detectionCount} detections · enrolled{" "}
              {new Date(identity.firstEnrolled).toLocaleDateString()}
            </p>
          </div>
        </header>

        {/* Thumbnails */}
        {identity.thumbnails.length > 0 && (
          <section className="animate-fade-in glass mb-5 rounded-2xl p-4">
            <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Enrollment angles ({identity.thumbnails.length})
            </p>
            <div className="flex gap-2 overflow-x-auto">
              {identity.thumbnails.map((t, i) => (
                <img
                  key={i}
                  src={t}
                  alt={`angle ${i}`}
                  className="h-20 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          </section>
        )}

        {/* Editable fields */}
        <section className="animate-fade-in glass mb-5 space-y-4 rounded-2xl p-5">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Group">
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
            >
              <option value="">Unassigned</option>
              <option value="Family">Family</option>
              <option value="Team">Team</option>
              <option value="Watch List">Watch List</option>
              <option value="__custom">Custom...</option>
            </select>
            {group === "__custom" && (
              <input
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="Custom group name"
                className="mt-2 w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
              />
            )}
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm"
            />
          </Field>
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="glow-hover inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            <Link
              to="/enroll"
              className="glow-hover inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2.5 text-sm"
            >
              Re-enroll
            </Link>
            <button
              onClick={onDelete}
              className="glow-hover inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </section>

        {/* Sightings */}
        <section className="animate-fade-in">
          <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Recent sightings ({sightings.length})
          </p>
          {sightings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No sightings yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {sightings.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5"
                >
                  {l.thumbnail && (
                    <img
                      src={l.thumbnail}
                      alt=""
                      className="h-10 w-10 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.feed}</p>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      {new Date(l.time).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {Math.round(l.confidence * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </p>
      {children}
    </label>
  );
}
