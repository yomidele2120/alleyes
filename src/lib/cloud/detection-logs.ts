import { supabase } from "@/integrations/supabase/client";

export type CloudLog = {
  id: string;
  user_id: string;
  identity_id: string | null;
  full_name: string | null;
  nin: string | null;
  confidence: number | null;
  camera_id: string | null;
  camera_name: string | null;
  snapshot_url: string | null;
  detected_at: string;
  age_estimate: number | null;
  gender: string | null;
};

export async function listLogs(opts?: {
  limit?: number;
  cameraId?: string;
  search?: string;
}): Promise<CloudLog[]> {
  let q = supabase
    .from("detection_logs")
    .select("*")
    .order("detected_at", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.cameraId) q = q.eq("camera_id", opts.cameraId);
  if (opts?.search) {
    const s = opts.search.replace(/[%_]/g, "");
    q = q.or(`full_name.ilike.%${s}%,nin.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CloudLog[];
}

export async function recordDetection(input: Partial<CloudLog>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("detection_logs").insert({ ...input, user_id: u.user.id });
}

export async function clearLogs() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("detection_logs").delete().eq("user_id", u.user.id);
}

export async function todayCount(): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("detection_logs")
    .select("*", { head: true, count: "exact" })
    .gte("detected_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}
