"use client";

import { useState } from "react";
import { Trophy, DollarSign, Flame } from "lucide-react";
import { AchievementCard } from "./components/achievement-card";
import { VerticalFilter } from "@/components/predictions/vertical-filter";
import { formatCurrency } from "@/lib/format";

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
}

// ============================================================
// HELPERS
// ============================================================

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
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
}: LogrosContentProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = activeFilter
    ? achievements.filter((a) => a.vertical === activeFilter)
    : achievements;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Logros
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          title="Ventas atribuidas"
          value={String(totalAtribuidas)}
          subtitle="predicciones convertidas este mes"
          icon={Trophy}
          color="bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600"
        />
        <KpiCard
          title="Monto atribuido"
          value={formatCurrency(montoAtribuido)}
          subtitle="valor generado con PymePilot"
          icon={DollarSign}
          color="bg-gradient-to-br from-green-50 to-green-100 text-green-600"
        />
        <KpiCard
          title="Racha"
          value={String(streak)}
          subtitle={
            streak === 0
              ? "dias habiles sin racha activa"
              : streak === 1
                ? "dia habil consecutivo"
                : "dias habiles consecutivos"
          }
          icon={Flame}
          color={
            streak >= 3
              ? "bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600"
              : "bg-gradient-to-br from-gray-50 to-gray-100 text-gray-500"
          }
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
              ? "No hay logros para este filtro"
              : "Todavia no hay ventas atribuidas este mes"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Cuando tus predicciones se conviertan en ventas, van a aparecer aca
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
