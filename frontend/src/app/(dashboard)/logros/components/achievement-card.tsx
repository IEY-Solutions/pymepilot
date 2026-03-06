"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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

function getStoryText(achievement: AchievementRow): string {
  const { customer_name, attribution_amount, total_orders, avg_days_between_purchases, vertical } = achievement;
  const monto = formatCurrency(Number(attribution_amount));

  if (vertical === "recuperacion") {
    return `${customer_name} volvio despues de estar inactivo y compro ${monto} \u2014 cliente recuperado`;
  }

  if (vertical === "cross_sell") {
    return `${customer_name} compro ${monto} en productos nuevos \u2014 se esta diversificando`;
  }

  if (total_orders === 1) {
    return `${customer_name} hizo su primera compra por ${monto} \u2014 nuevo cliente activado`;
  }

  if (total_orders === 2) {
    return `${customer_name} hizo su segunda compra por ${monto} \u2014 se esta convirtiendo en recurrente`;
  }

  if (total_orders >= 3 && avg_days_between_purchases) {
    return `${customer_name} volvio a comprar por ${monto} \u2014 compra cada ~${Math.round(avg_days_between_purchases)} dias como siempre`;
  }

  return `${customer_name} compro por ${monto} \u2014 ${total_orders} compras totales`;
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
  const [expanded, setExpanded] = useState(false);

  const badge = verticalBadge[achievement.vertical] ?? {
    label: achievement.vertical,
    className: "bg-gray-100 text-gray-700",
  };

  const timeAgo = getTimeAgo(achievement.attribution_date);
  const story = getStoryText(achievement);

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Colapsada: nombre + monto + badge + chevron */}
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {achievement.customer_name}
            </h3>
          </div>
          <span
            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <p className="font-bold text-green-600">
            {formatCurrency(Number(achievement.attribution_amount))}
          </p>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expandida: historia + productos + tiempo */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          <p className="text-sm text-gray-700">{story}</p>

          {achievement.products && achievement.products.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Productos:</p>
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

          <p className="text-xs text-gray-400">{timeAgo}</p>
        </div>
      )}
    </div>
  );
}
