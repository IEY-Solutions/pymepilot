import { createClient } from "@/lib/supabase/server";
import { MetricasContent } from "./metricas-content";

export default async function MetricasPage() {
  const supabase = await createClient();

  // 4 RPCs + ranking en paralelo
  const [revenueRes, churnRes, ticketRes, valueRes, rankingRes] =
    await Promise.all([
      supabase.rpc("get_monthly_revenue_split", { p_months: 6 }),
      supabase.rpc("get_monthly_churn", { p_months: 6 }),
      supabase.rpc("get_monthly_ticket", { p_months: 6 }),
      supabase.rpc("get_monthly_value", { p_months: 6 }),
      supabase
        .from("client_rankings_secure")
        .select("*")
        .order("ranking", { ascending: true })
        .limit(50),
    ]);

  return (
    <MetricasContent
      revenue={revenueRes.data ?? []}
      churn={churnRes.data ?? []}
      ticket={ticketRes.data ?? []}
      value={valueRes.data ?? []}
      rankings={rankingRes.data ?? []}
    />
  );
}
