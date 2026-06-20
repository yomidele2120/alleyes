import { supabase } from "@/integrations/supabase/client";
import { backendClearLogs, backendListLogs } from "@/lib/lens-backend";

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
  try {
    const remote = await backendListLogs({ cameraId: opts?.cameraId, limit: opts?.limit });
    return remote.map((entry) => ({
      id: entry.id,
      user_id: "backend",
      identity_id: entry.identity_id ?? null,
      full_name: (entry.full_name as string | null) ?? null,
      nin: (entry.nin as string | null) ?? null,
      confidence: entry.confidence ?? null,
      camera_id: entry.camera_id ?? null,
      camera_name: (entry.camera_name as string | null) ?? null,
      snapshot_url: (entry.snapshot_url as string | null) ?? null,
      detected_at: entry.detected_at,
      age_estimate: (entry.age_estimate as number | null) ?? null,
      gender: (entry.gender as string | null) ?? null,
    }));
  } catch {
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
}

export async function recordDetection(input: Partial<CloudLog>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("detection_logs").insert({ ...input, user_id: u.user.id });
}

export async function clearLogs() {
  try {
    await backendClearLogs();
  } catch {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("detection_logs").delete().eq("user_id", u.user.id);
  }
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
