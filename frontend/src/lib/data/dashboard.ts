import { createClient } from "@/lib/supabase/server";
import { withRequestDedup, withSwrCache } from "@/lib/cache";

export const getCurrentUser = withRequestDedup(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getUnreadNotificationsCount = withSwrCache(
  "notifications:unread-count",
  async (_tenantId: string) => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false);
    return count ?? 0;
  },
  { revalidate: 60, tags: ["notifications"] }
);

export const getPendingPredictionsCount = withRequestDedup(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
});

export const getTotalPredictionsCount = withRequestDedup(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
});

export const getContactedPredictionsCount = withRequestDedup(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .in("status", ["contacted", "completed"]);
  return count ?? 0;
});

export const getActiveCustomersCount = withRequestDedup(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return count ?? 0;
});

export interface LastSync {
  started_at: string | null;
  status: string | null;
}

export const getLastSync = withRequestDedup(async (): Promise<LastSync> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sync_log")
    .select("started_at, status")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    started_at: data?.started_at ?? null,
    status: data?.status ?? null,
  };
});

export const getTodayPredictionsCount = withRequestDedup(async () => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("prediction_date", new Date().toISOString().split("T")[0]);
  return count ?? 0;
});

export interface LastRun {
  completed_at: string | null;
  status: string | null;
  predictions_generated: number | null;
}

export const getLastRun = withRequestDedup(async (): Promise<LastRun> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orchestrator_runs")
    .select("completed_at, status, predictions_generated")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    completed_at: data?.completed_at ?? null,
    status: data?.status ?? null,
    predictions_generated: data?.predictions_generated ?? null,
  };
});
