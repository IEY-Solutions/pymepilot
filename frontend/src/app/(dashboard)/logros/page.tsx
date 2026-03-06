import { createClient } from "@/lib/supabase/server";
import { LogrosContent } from "./logros-content";
import type { AchievementRow } from "./logros-content";

export default async function LogrosPage() {
  const supabase = await createClient();

  // 3 RPCs en paralelo
  const [achievementsRes, streakRes, salesRes] = await Promise.all([
    supabase.rpc("get_achievements"),
    supabase.rpc("get_streak_days"),
    supabase.rpc("get_total_sales"),
  ]);

  const achievements: AchievementRow[] = achievementsRes.data ?? [];
  const streak: number = streakRes.data ?? 0;
  // get_total_sales devuelve filas por mes ordenadas ASC
  // Buscar la fila del mes actual (puede no existir si no hubo ventas)
  const salesRows: { month: string; total_orders: number; total_revenue: number }[] = salesRes.data ?? [];
  const now = new Date();
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthRow = salesRows.find((r) => r.month.startsWith(thisMonthStr)) ?? {
    total_orders: 0,
    total_revenue: 0,
  };

  const totalAtribuidas = achievements.length;
  const montoAtribuido = achievements.reduce(
    (sum, a) => sum + Number(a.attribution_amount ?? 0),
    0
  );

  return (
    <LogrosContent
      achievements={achievements}
      totalAtribuidas={totalAtribuidas}
      montoAtribuido={montoAtribuido}
      streak={streak}
      totalOrders={currentMonthRow.total_orders}
      totalRevenue={currentMonthRow.total_revenue}
    />
  );
}
