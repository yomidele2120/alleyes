import { supabase } from "@/integrations/supabase/client";

export type CloudCamera = {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  rtmp_key: string;
  stream_url: string | null;
  is_active: boolean;
  added_at: string;
};

export async function listCameras(): Promise<CloudCamera[]> {
  const { data, error } = await supabase
    .from("cameras")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudCamera[];
}

export async function createCamera(input: {
  name: string;
  location?: string;
  rtmp_key: string;
  stream_url?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("cameras")
    .insert({ ...input, user_id: u.user.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as CloudCamera;
}

export async function updateCamera(id: string, patch: Partial<CloudCamera>) {
  const { error } = await supabase.from("cameras").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCamera(id: string) {
  const { error } = await supabase.from("cameras").delete().eq("id", id);
  if (error) throw error;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
