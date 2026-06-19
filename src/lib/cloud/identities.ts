import { supabase } from "@/integrations/supabase/client";

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
  const { error } = await supabase.from("identities").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteIdentity(id: string) {
  const { error } = await supabase.from("identities").delete().eq("id", id);
  if (error) throw error;
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
  const { count, error } = await supabase
    .from("identities")
    .select("*", { head: true, count: "exact" })
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}
