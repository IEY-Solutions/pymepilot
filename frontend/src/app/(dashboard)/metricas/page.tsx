import { createClient } from "@/lib/supabase/server";
import { MetricasContent } from "./metricas-content";
import type { RankingRow } from "./metricas-content";

export default async function MetricasPage() {
  const supabase = await createClient();

  // RPCs + ranking + tendencias + product rankings + demanda en paralelo
  const [revenueRes, churnRes, ticketRes, valueRes, salesRes, rankingRes, trendsRes, productRankingsRes, demandRes, clientDemandRes] =
    await Promise.all([
      supabase.rpc("get_monthly_revenue_split", { p_months: 12 }),
      supabase.rpc("get_monthly_churn", { p_months: 12 }),
      supabase.rpc("get_monthly_ticket", { p_months: 12 }),
      supabase.rpc("get_monthly_value", { p_months: 12 }),
      supabase.rpc("get_total_sales", { p_months: 12 }),
      supabase
        .from("client_rankings_secure")
        .select("*")
        .order("ranking", { ascending: true })
        .limit(50),
      supabase.rpc("get_client_trends", { p_months_window: 3 }),
      supabase.rpc("get_product_rankings"),
      supabase.rpc("get_demand_projection", { p_limit: 15 }),
      supabase.rpc("get_client_demand_projection", { p_limit: 15 }),
    ]);

  // Mergear tendencias con rankings via Map (O(n), no O(n²))
  const trendMap = new Map<string, string>();
  for (const t of trendsRes.data ?? []) {
    trendMap.set(t.customer_id, t.trend);
  }

  const rankingsWithTrend: RankingRow[] = (rankingRes.data ?? []).map(
    (r: Omit<RankingRow, "trend">) => ({
      ...r,
      trend: (trendMap.get(r.customer_id) ?? "stable") as
        | "up"
        | "down"
        | "stable",
    })
  );

  return (
    <MetricasContent
      revenue={revenueRes.data ?? []}
      churn={churnRes.data ?? []}
      ticket={ticketRes.data ?? []}
      value={valueRes.data ?? []}
      sales={salesRes.data ?? []}
      rankings={rankingsWithTrend}
      productRankings={productRankingsRes.data ?? []}
      demandProjections={demandRes.data ?? []}
      clientDemand={clientDemandRes.data ?? []}
    />
  );
}
