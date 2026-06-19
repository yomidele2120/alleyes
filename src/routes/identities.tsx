import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2, User } from "lucide-react";
import { LensNav } from "@/components/lens-nav";
import { SignInGate } from "@/components/sign-in-gate";
import { useSession } from "@/hooks/use-session";
import {
  createIdentity,
  deleteIdentity,
  listIdentities,
  type CloudIdentity,
} from "@/lib/cloud/identities";
import { uploadBlob } from "@/lib/cloud/upload";

export const Route = createFileRoute("/identities")({
  head: () => ({
    meta: [
      { title: "Identities — LENS" },
      { name: "description", content: "Manage enrolled identities for face recognition." },
    ],
  }),
  component: IdentitiesPage,
});

function IdentitiesPage() {
  const { user, loading } = useSession();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const q = useQuery({
    queryKey: ["identities", { search, group }],
    queryFn: () => listIdentities({ search, group }),
    enabled: !!user,
  });

  if (loading) return null;
  if (!user) return <SignInGate feature="Identities" />;

  const items = q.data ?? [];

  return (
    <div className="relative min-h-screen mesh-bg pb-28 md:pb-10 pt-24">
      <div className="absolute inset-0 grid-overlay opacity-30" />
      <LensNav />
      <main className="relative mx-auto max-w-6xl px-5">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Database</p>
            <h1 className="font-display text-3xl tracking-[0.2em]">Identities</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or NIN…"
                className="rounded-lg border border-border bg-input/40 py-2 pl-8 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">All groups</option>
              <option value="staff">Staff</option>
              <option value="vip">VIP</option>
              <option value="watchlist">Watchlist</option>
              <option value="public">Public</option>
            </select>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add Identity
            </button>
          </div>
        </header>

        {q.isLoading ? (
          <div className="glass rounded-2xl p-8 text-center text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <User className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-xl tracking-[0.15em]">No identities yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first identity. Use Enroll for guided multi-angle capture.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((i) => (
              <IdentityCard
                key={i.id}
                identity={i}
                onDelete={() => qc.invalidateQueries({ queryKey: ["identities"] })}
              />
            ))}
          </ul>
        )}
      </main>

      {showAdd && (
        <AddIdentityModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["identities"] });
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}

function IdentityCard({ identity, onDelete }: { identity: CloudIdentity; onDelete: () => void }) {
  async function remove() {
    if (!confirm(`Delete "${identity.full_name}"?`)) return;
    try {
      await deleteIdentity(identity.id);
      toast.success("Removed");
      onDelete();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  }
  return (
    <li className="glass rounded-2xl p-4">
      <div className="flex gap-3">
        {identity.photo_url ? (
          <img
            src={identity.photo_url}
            alt={identity.full_name}
            className="h-16 w-16 flex-shrink-0 rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display text-2xl text-primary">
            {identity.full_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{identity.full_name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {identity.nin || "—"} · {identity.id_type}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <GroupBadge tag={identity.group_tag} />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {identity.embeddings_multi?.length || (identity.embedding ? 1 : 0)} embeddings
            </span>
          </div>
        </div>
        <button onClick={remove} className="text-muted-foreground hover:text-red-400" aria-label="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function GroupBadge({ tag }: { tag: string }) {
  const color =
    tag === "watchlist"
      ? "border-red-500/40 text-red-400"
      : tag === "vip"
        ? "border-gold/50 text-[color:var(--gold)]"
        : tag === "staff"
          ? "border-primary/40 text-primary"
          : "border-border text-muted-foreground";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.2em] ${color}`}>
      {tag}
    </span>
  );
}

function AddIdentityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    full_name: "",
    nin: "",
    id_type: "NIN",
    date_of_birth: "",
    gender: "",
    nationality: "",
    group_tag: "public",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    if (!form.full_name) return toast.error("Name required");
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (file) photo_url = await uploadBlob(file, "identities");
      await createIdentity({
        full_name: form.full_name,
        nin: form.nin || null,
        id_type: form.id_type,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        photo_url,
        embedding: null,
        group_tag: form.group_tag,
        notes: form.notes || null,
      });
      toast.success("Identity enrolled");
      onCreated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
    >
      <div className="glass my-8 w-full max-w-lg rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-2xl tracking-[0.15em]">Add Identity</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Quick enrollment with a single photo. For multi-angle precision, use the Enroll flow.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="NIN / ID number">
            <input
              value={form.nin}
              onChange={(e) => set("nin", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="ID type">
            <select
              value={form.id_type}
              onChange={(e) => set("id_type", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option>NIN</option>
              <option>PASSPORT</option>
              <option>STAFF_ID</option>
              <option>CUSTOM</option>
            </select>
          </Field>
          <Field label="Group">
            <select
              value={form.group_tag}
              onChange={(e) => set("group_tag", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="public">Public</option>
              <option value="staff">Staff</option>
              <option value="vip">VIP</option>
              <option value="watchlist">Watchlist</option>
            </select>
          </Field>
          <Field label="Date of birth">
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => set("date_of_birth", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="Gender">
            <input
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <Field label="Nationality">
            <input
              value={form.nationality}
              onChange={(e) => set("nationality", e.target.value)}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Photo">
              <div className="flex items-center gap-3">
                {preview && (
                  <img
                    src={preview}
                    alt=""
                    className="h-16 w-16 rounded-xl border border-border object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-input/40 file:px-3 file:py-1.5 file:text-xs"
                />
              </div>
            </Field>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : "Enroll"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
