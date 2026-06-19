import { supabase } from "@/integrations/supabase/client";

const BUCKET = "lens-media";

export async function uploadBlob(blob: Blob, folder: string, ext = "jpg"): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const key = `${u.user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? key;
}

export async function uploadDataUrl(dataUrl: string, folder: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return uploadBlob(blob, folder, "jpg");
}
