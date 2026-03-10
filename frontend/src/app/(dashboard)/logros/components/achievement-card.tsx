"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { AchievementRow } from "../logros-content";

const verticalBadge: Record<string, { label: string; className: string }> = {
  reposicion: {
    label: "Reposicion",
    className: "bg-blue-500/20 text-blue-400",
  },
  activacion: {
    label: "Activacion",
    className: "bg-green-500/20 text-green-400",
  },
  recuperacion: {
    label: "Recuperacion",
    className: "bg-amber-500/20 text-amber-400",
  },
  cross_sell: {
    label: "Cross-sell",
    className: "bg-indigo-500/20 text-indigo-400",
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
    className: "bg-white/10 text-white/50",
  };

  const timeAgo = getTimeAgo(achievement.attribution_date);
  const story = getStoryText(achievement);

  return (
    <div
      className="glass-dark cursor-pointer hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(129,181,161,0.1)] transition-shadow"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-white truncate">
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
          <p className="font-bold text-green-400">
            {formatCurrency(Number(achievement.attribution_amount))}
          </p>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3 space-y-2">
          <p className="text-sm text-white/70">{story}</p>

          {achievement.products && achievement.products.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1">Productos:</p>
              <div className="flex flex-wrap gap-1">
                {achievement.products.map((product, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-white/[0.06] text-white/60 px-2 py-0.5 rounded"
                  >
                    {product.name} x{product.quantity}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-white/40">{timeAgo}</p>
        </div>
      )}
    </div>
  );
}
