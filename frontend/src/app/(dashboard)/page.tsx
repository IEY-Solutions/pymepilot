import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  MessageSquare,
  UserCheck,
  Users,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { getFreshnessInfo } from "@/lib/freshness";

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Hace menos de 1 hora";
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} dia${days !== 1 ? "s" : ""}`;
}

export default async function HomePage() {
  const supabase = await createClient();

  // Queries en paralelo para los 4 KPIs
  const [pendingRes, contactRateRes, activeRes, lastSyncRes] =
    await Promise.all([
      // 1. Predicciones pendientes
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      // 2. Tasa de contacto 30d (contacted / total)
      supabase.from("predictions").select("status"),

      // 3. Clientes activos
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // 4. Ultima sync
      supabase
        .from("sync_log")
        .select("started_at, status")
        .order("started_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

  const pendingCount = pendingRes.count ?? 0;

  // Calcular tasa de contacto
  const allPredictions = contactRateRes.data ?? [];
  const contacted = allPredictions.filter(
    (p) => p.status === "contacted" || p.status === "completed"
  ).length;
  const contactRate =
    allPredictions.length > 0
      ? Math.round((contacted / allPredictions.length) * 100)
      : 0;

  const activeCount = activeRes.count ?? 0;

  const lastSync = lastSyncRes.data;
  const lastSyncTime = lastSync?.started_at ?? null;
  const freshness = getFreshnessInfo(lastSyncTime);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <KpiCard
          title="Pendientes"
          value={pendingCount}
          subtitle="Predicciones para contactar"
          icon={MessageSquare}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          title="Tasa contacto"
          value={`${contactRate}%`}
          subtitle={`${contacted} de ${allPredictions.length} total`}
          icon={UserCheck}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          title="Clientes activos"
          value={activeCount}
          subtitle="Con compras recientes"
          icon={Users}
          color="bg-purple-50 text-purple-600"
        />
        <KpiCard
          title="Ultima sync"
          value={timeAgo(lastSyncTime)}
          subtitle={lastSync?.status === "completed" ? "OK" : lastSync?.status ?? "Sin datos"}
          icon={RefreshCw}
          color="bg-orange-50 text-orange-600"
        />
      </div>

      {/* Card de frescura — solo visible si datos NO estan frescos */}
      {freshness && freshness.color !== "green" && (
        <div
          className={`flex items-center justify-between gap-3 p-4 ${freshness.bgClass} border ${freshness.borderClass} rounded-lg`}
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
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-xs text-green-800">{freshness.label}</p>
        </div>
      )}
    </div>
  );
}
