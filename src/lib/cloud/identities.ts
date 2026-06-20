import { supabase } from "@/integrations/supabase/client";
import {
  backendDeleteIdentity,
  backendListIdentities,
  backendUpdateIdentity,
  type BackendIdentity,
} from "@/lib/lens-backend";

export type CloudIdentity = {
  id: string;
  user_id: string;
  full_name: string;
  nin: string | null;
  id_type: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  photo_url: string | null;
  embedding: number[] | null;
  embeddings_multi: number[][];
  group_tag: string;
  notes: string | null;
  enrolled_at: string;
  is_active: boolean;
};

export type NewIdentity = Omit<
  CloudIdentity,
  "id" | "user_id" | "enrolled_at" | "is_active" | "embeddings_multi"
> & {
  embeddings_multi?: number[][];
};

export async function listIdentities(opts?: {
  search?: string;
  group?: string;
}): Promise<CloudIdentity[]> {
  try {
    const remote = await backendListIdentities(opts);
    return remote.map((item: BackendIdentity) => ({
      id: item.id,
      user_id: "backend",
      full_name: item.full_name,
      nin: item.nin,
      id_type: item.id_type,
      date_of_birth: (item["date_of_birth"] as string | null) ?? null,
      gender: (item["gender"] as string | null) ?? null,
      nationality: (item["nationality"] as string | null) ?? null,
      photo_url: item.photo_url,
      embedding: item.embedding ?? null,
      embeddings_multi: item.embeddings_multi ?? [],
      group_tag: item.group_tag,
      notes: (item.notes as string | null) ?? null,
      enrolled_at: item.enrolled_at ?? new Date().toISOString(),
      is_active: item.is_active ?? true,
    }));
  } catch {
    let q = supabase
      .from("identities")
      .select("*")
      .eq("is_active", true)
      .order("enrolled_at", { ascending: false });
    if (opts?.group && opts.group !== "all") q = q.eq("group_tag", opts.group);
    if (opts?.search) {
      const s = opts.search.replace(/[%_]/g, "");
      q = q.or(`full_name.ilike.%${s}%,nin.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as CloudIdentity[];
  }
}

export async function createIdentity(payload: NewIdentity): Promise<CloudIdentity> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("identities")
    .insert({
      ...payload,
      user_id: u.user.id,
      embeddings_multi: payload.embeddings_multi ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudIdentity;
}

export async function updateIdentity(id: string, patch: Partial<CloudIdentity>) {
  try {
    await backendUpdateIdentity(id, patch);
  } catch {
    const { error } = await supabase.from("identities").update(patch).eq("id", id);
    if (error) throw error;
  }
}

export async function deleteIdentity(id: string) {
  try {
    await backendDeleteIdentity(id);
  } catch {
    const { error } = await supabase.from("identities").delete().eq("id", id);
    if (error) throw error;
  }
}

export async function appendEmbedding(id: string, embedding: number[]) {
  const { data, error } = await supabase
    .from("identities")
    .select("embeddings_multi")
    .eq("id", id)
    .single();
  if (error) throw error;
  const next = [...((data?.embeddings_multi as number[][]) ?? []), embedding];
  await updateIdentity(id, { embeddings_multi: next });
}

export async function countIdentities(): Promise<number> {
  try {
    const remote = await backendListIdentities();
    return remote.length;
  } catch {
    const { count, error } = await supabase
      .from("identities")
      .select("*", { head: true, count: "exact" })
      .eq("is_active", true);
    if (error) throw error;
    return count ?? 0;
  }
}
