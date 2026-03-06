import { createClient } from "@/lib/supabase/server";
import { LogrosContent } from "./logros-content";
import type { AchievementRow } from "./logros-content";

export default async function LogrosPage() {
  const supabase = await createClient();

  // 2 RPCs en paralelo
  const [achievementsRes, streakRes] = await Promise.all([
    supabase.rpc("get_achievements"),
    supabase.rpc("get_streak_days"),
  ]);

  // Calcular KPIs del mes actual
  const achievements: AchievementRow[] = achievementsRes.data ?? [];
  const streak: number = streakRes.data ?? 0;

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
    />
  );
}
