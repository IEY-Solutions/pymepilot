"use client";

import { useState } from "react";
import { Trophy, DollarSign, Flame, ShoppingBag } from "lucide-react";
import { AchievementCard } from "./components/achievement-card";
import { VerticalFilter } from "@/components/predictions/vertical-filter";
import { formatCurrency } from "@/lib/format";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

// ============================================================
// TIPOS
// ============================================================

export interface AchievementRow {
  prediction_id: string;
  customer_name: string;
  vertical: string;
  attribution_date: string;
  attribution_amount: number;
  products: { name: string; quantity: number; total_price: number }[];
  total_orders: number;
  avg_days_between_purchases: number | null;
}

interface LogrosContentProps {
  achievements: AchievementRow[];
  totalAtribuidas: number;
  montoAtribuido: number;
  streak: number;
  totalOrders: number;
  totalRevenue: number;
}

// ============================================================
// HELPERS
// ============================================================

const currentMonth = new Date().toLocaleString("es-AR", { month: "long" });

function getStreakSubtitle(streak: number): string {
  if (streak === 0)
    return "Vende hoy para arrancar una racha de dias consecutivos";
  if (streak === 1)
    return "Vendiste hoy \u2014 PymePilot te ayuda a mantener la racha";
  if (streak <= 4)
    return "Vas bien \u2014 PymePilot te ayuda a mantener la racha";
  return "Gran racha \u2014 segui asi con las recomendaciones de PymePilot";
}

function getStreakValue(streak: number): string {
  if (streak === 0) return "Sin racha";
  if (streak === 1) return "1 dia";
  return `${streak} dias seguidos`;
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
          {tooltip && <InfoTooltip text={tooltip} />}
        </span>
        <div className={`p-2.5 rounded-full ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1.5">{subtitle}</p>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function LogrosContent({
  achievements,
  totalAtribuidas,
  montoAtribuido,
  streak,
  totalOrders,
  totalRevenue,
}: LogrosContentProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = activeFilter
    ? achievements.filter((a) => a.vertical === activeFilter)
    : achievements;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Mis ventas
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Mis ventas del mes"
          value={
            totalOrders > 0
              ? `${totalOrders} ordenes \u00B7 ${formatCurrency(totalRevenue)}`
              : "Sin ventas"
          }
          subtitle={
            totalOrders > 0
              ? `en ${currentMonth}`
              : "PymePilot tiene clientes listos para que los contactes"
          }
          icon={ShoppingBag}
          color="bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600"
          tooltip={TOOLTIPS["logros.ventas_mes"]}
        />
        <KpiCard
          title="Ventas con PymePilot"
          value={
            totalAtribuidas > 0
              ? `${totalAtribuidas} ordenes \u00B7 ${formatCurrency(montoAtribuido)}`
              : "Sin ventas asistidas"
          }
          subtitle={
            totalAtribuidas > 0
              ? "clientes contactados que compraron"
              : "Cuando un cliente recomendado compre, lo vas a ver aca"
          }
          icon={Trophy}
          color="bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600"
          tooltip={TOOLTIPS["logros.ventas_pymepilot"]}
        />
        <KpiCard
          title="Racha de ventas"
          value={getStreakValue(streak)}
          subtitle={getStreakSubtitle(streak)}
          icon={Flame}
          color={
            streak >= 3
              ? "bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600"
              : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-500"
          }
          tooltip={TOOLTIPS["logros.racha"]}
        />
      </div>

      {/* Filtro por vertical */}
      {achievements.length > 0 && (
        <div>
          <VerticalFilter
            predictions={achievements}
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
          />
        </div>
      )}

      {/* Lista de logros */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {activeFilter
              ? "No hay ventas para este filtro"
              : "Todavia sin ventas este mes"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Cada vez que un cliente recomendado compre, va a aparecer aca
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((achievement) => (
            <AchievementCard
              key={achievement.prediction_id}
              achievement={achievement}
            />
          ))}
        </div>
      )}
    </div>
  );
}
