"use client";

import { formatCurrency } from "@/lib/format";
import type { AchievementRow } from "../logros-content";

const verticalBadge: Record<string, { label: string; className: string }> = {
  reposicion: {
    label: "Reposicion",
    className: "bg-blue-100 text-blue-700",
  },
  activacion: {
    label: "Activacion",
    className: "bg-green-100 text-green-700",
  },
  recuperacion: {
    label: "Recuperacion",
    className: "bg-amber-100 text-amber-700",
  },
  cross_sell: {
    label: "Cross-sell",
    className: "bg-indigo-100 text-indigo-700",
  },
};

function getPatternText(achievement: AchievementRow): string {
  const { total_orders, avg_days_between_purchases, vertical } = achievement;

  if (vertical === "recuperacion") {
    return `Volvio despues de estar inactivo`;
  }

  if (total_orders === 1) {
    return "Primera compra";
  }

  if (total_orders === 2) {
    return "Se esta fidelizando";
  }

  if (total_orders >= 3 && avg_days_between_purchases) {
    return `Recurrente: compra cada ~${Math.round(avg_days_between_purchases)} dias`;
  }

  return `${total_orders} compras totales`;
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} dias`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

export function AchievementCard({
  achievement,
}: {
  achievement: AchievementRow;
}) {
  const badge = verticalBadge[achievement.vertical] ?? {
    label: achievement.vertical,
    className: "bg-gray-100 text-gray-700",
  };

  const pattern = getPatternText(achievement);
  const timeAgo = getTimeAgo(achievement.attribution_date);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {/* Header: nombre + monto + badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">
            {achievement.customer_name}
          </h3>
          <p className="text-sm text-gray-500">{timeAgo}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-green-600">
            {formatCurrency(Number(achievement.attribution_amount))}
          </p>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
      </div>

      {/* Patron del cliente */}
      <p className="text-sm text-gray-600 mb-2">{pattern}</p>

      {/* Productos comprados */}
      {achievement.products && achievement.products.length > 0 && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <p className="text-xs text-gray-400 mb-1">Productos comprados:</p>
          <div className="flex flex-wrap gap-1">
            {achievement.products.map((product, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded"
              >
                {product.name} x{product.quantity}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
