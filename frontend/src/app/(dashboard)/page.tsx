import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  MessageSquare,
  UserCheck,
  Users,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react";
import { getFreshnessInfo } from "@/lib/freshness";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  tooltip,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="glass-dark p-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/50">
          {title}
          {tooltip && <InfoTooltip text={tooltip} />}
        </span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-1">{subtitle}</p>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return "—";
  const diff = Math.max(0, Date.now() - time);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Hace menos de 1 hora";
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} dia${days !== 1 ? "s" : ""}`;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default async function HomePage() {
  const supabase = await createClient();

  // Queries en paralelo para KPIs + indicador del orquestador
  const [
    pendingRes,
    totalPredRes,
    contactedPredRes,
    activeRes,
    lastSyncRes,
    todayPredRes,
    lastRunRes,
  ] = await Promise.all([
      // 1. Predicciones pendientes
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // 2a. Total predictions (M-08 FIX: count en vez de traer todas las filas)
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true }),

      // 2b. Predictions contactadas/completadas
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .in("status", ["contacted", "completed"]),

      // 3. Clientes activos
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // 4. Ultima sync (L-04 FIX: maybeSingle en vez de single)
      supabase
        .from("sync_log")
        .select("started_at, status")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      // 5. Predicciones generadas hoy (para tarjeta del orquestador)
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("prediction_date", new Date().toISOString().split("T")[0]),

      // 6. Ultima corrida del orquestador
      supabase
        .from("orchestrator_runs")
        .select("completed_at, status, predictions_generated")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const pendingCount = pendingRes.count ?? 0;

  // Calcular tasa de contacto con counts (no filas individuales)
  const totalPredictions = totalPredRes.count ?? 0;
  const contactedCount = contactedPredRes.count ?? 0;
  const contactRate =
    totalPredictions > 0
      ? Math.round((contactedCount / totalPredictions) * 100)
      : 0;

  const activeCount = activeRes.count ?? 0;

  const lastSync = lastSyncRes.data;
  const lastSyncTime = lastSync?.started_at ?? null;
  const freshness = getFreshnessInfo(lastSyncTime);

  const todayPredictions = todayPredRes.count ?? 0;
  const lastRun = lastRunRes.data;
  const lastRunTime = lastRun?.completed_at ?? null;
  const lastRunStatus = lastRun?.status ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Inicio</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCard
          title="Pendientes"
          value={pendingCount}
          subtitle="Predicciones para contactar"
          icon={MessageSquare}
          color="bg-[#81b5a1]/15 text-[#81b5a1]"
          tooltip={TOOLTIPS["home.pendientes"]}
        />
        <KpiCard
          title="Tasa contacto"
          value={`${contactRate}%`}
          subtitle={`${contactedCount} de ${totalPredictions} total`}
          icon={UserCheck}
          color="bg-green-500/15 text-green-400"
          tooltip={TOOLTIPS["home.tasa_contacto"]}
        />
        <KpiCard
          title="Clientes activos"
          value={activeCount}
          subtitle="Con compras recientes"
          icon={Users}
          color="bg-purple-500/15 text-purple-400"
          tooltip={TOOLTIPS["home.clientes_activos"]}
        />
        <KpiCard
          title="Ultima sync"
          value={timeAgo(lastSyncTime)}
          subtitle={lastSync?.status === "completed" ? "OK" : lastSync?.status ?? "Sin datos"}
          icon={RefreshCw}
          color="bg-orange-500/15 text-orange-400"
          tooltip={TOOLTIPS["home.ultima_sync"]}
        />
      </div>

      {/* Card del orquestador — predicciones del dia */}
      {todayPredictions > 0 && (
        <div className="flex items-center justify-between gap-3 p-4 bg-indigo-500/15 border border-indigo-500/30 rounded-2xl">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">
                {todayPredictions} contacto{todayPredictions !== 1 ? "s" : ""} sugerido{todayPredictions !== 1 ? "s" : ""} hoy
              </p>
              <p className="text-xs text-indigo-400 opacity-80 mt-0.5">
                {lastRunTime
                  ? `Ultima corrida: ${formatTime(lastRunTime)}${lastRunStatus && lastRunStatus !== "completed" ? ` (${lastRunStatus})` : ""}`
                  : "Sin corridas registradas"}
              </p>
            </div>
          </div>
          <Link
            href="/pipeline"
            className="text-xs text-indigo-400 underline shrink-0"
          >
            Ver contactos
          </Link>
        </div>
      )}

      {/* Card de frescura — solo visible si datos NO estan frescos */}
      {freshness && freshness.color !== "green" && (
        <div
          className={`flex items-center justify-between gap-3 p-4 ${freshness.bgClass} border ${freshness.borderClass} rounded-2xl`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle
              className={`h-5 w-5 ${freshness.textClass} shrink-0`}
            />
            <div>
              <p className={`text-sm font-medium ${freshness.textClass}`}>
                {freshness.label}
              </p>
              <p
                className={`text-xs ${freshness.textClass} opacity-80 mt-0.5`}
              >
                {freshness.message}
              </p>
            </div>
          </div>
          <Link
            href="/datos"
            className={`text-xs ${freshness.textClass} underline shrink-0`}
          >
            Actualizar
          </Link>
        </div>
      )}

      {freshness && freshness.color === "green" && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded-2xl">
          <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
          <p className="text-xs text-green-400">{freshness.label}</p>
        </div>
      )}
    </div>
  );
}
