"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { RankingRow } from "./metricas-content";
import { ClientDetail } from "./client-detail";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "\u2014";
  const diff = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff}d`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 text-sm font-medium text-gray-400">
      {rank}
    </span>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (trend === "down") {
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  }
  return <Minus className="h-4 w-4 text-gray-300" />;
}

function RevenueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-900 w-16 text-right">
        {formatCurrency(value)}
      </span>
      <div className="w-16 h-1.5 bg-gray-100 rounded-full hidden lg:block">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ClientRankingTable({
  rankings,
}: {
  rankings: RankingRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const maxRevenue =
    rankings.length > 0
      ? Math.max(...rankings.map((r) => Number(r.total_revenue)))
      : 0;

  if (rankings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
        Sin datos de ranking. Se calculan con el primer refresh de vistas
        materializadas.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Header — visible en desktop (8 columnas con Tend.) */}
      <div className="hidden md:grid md:grid-cols-[3rem_1fr_2.5rem_8.5rem_5rem_5rem_5rem_5rem] gap-2 px-5 py-3 bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <span>#</span>
        <span>Cliente</span>
        <span className="text-center">Tend.</span>
        <span className="text-right">Facturacion</span>
        <span className="text-right">Compras</span>
        <span className="text-right">Ticket</span>
        <span className="text-right">Ult. compra</span>
        <span className="text-right">Freq.</span>
      </div>

      {/* Filas */}
      {rankings.map((client) => {
        const isExpanded = expandedId === client.customer_id;
        return (
          <div key={client.customer_id}>
            <button
              onClick={() =>
                setExpandedId(isExpanded ? null : client.customer_id)
              }
              className="w-full text-left hover:bg-gray-50/60 transition-colors duration-150"
            >
              {/* Vista desktop (8 columnas) */}
              <div className="hidden md:grid md:grid-cols-[3rem_1fr_2.5rem_8.5rem_5rem_5rem_5rem_5rem] gap-2 px-5 py-3.5 items-center border-b border-gray-50">
                <RankBadge rank={client.ranking} />
                <span className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                  {client.name}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-300" />
                  )}
                </span>
                <span className="flex justify-center">
                  <TrendArrow trend={client.trend} />
                </span>
                <RevenueBar
                  value={Number(client.total_revenue)}
                  max={maxRevenue}
                />
                <span className="text-sm text-gray-600 text-right">
                  {client.total_orders}
                </span>
                <span className="text-sm text-gray-600 text-right">
                  {formatCurrency(Number(client.avg_ticket))}
                </span>
                <span className="text-sm text-gray-500 text-right">
                  {daysAgo(client.last_purchase)}
                </span>
                <span className="text-sm text-gray-500 text-right">
                  {client.avg_days_between_purchases
                    ? `~${Math.round(Number(client.avg_days_between_purchases))}d`
                    : "\u2014"}
                </span>
              </div>

              {/* Vista mobile — compacta con icono de tendencia */}
              <div className="md:hidden px-4 py-3.5 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <RankBadge rank={client.ranking} />
                    <span className="text-sm font-semibold text-gray-900">
                      {client.name}
                    </span>
                    <TrendArrow trend={client.trend} />
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-300" />
                  )}
                </div>
                <div className="flex gap-4 mt-1.5 ml-10 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">
                    {formatCurrency(Number(client.total_revenue))}
                  </span>
                  <span>{client.total_orders} compras</span>
                  <span>{daysAgo(client.last_purchase)}</span>
                </div>
              </div>
            </button>

            {/* Panel expandible */}
            {isExpanded && (
              <div className="px-5 py-4 bg-gray-50/50 border-b border-gray-100">
                <ClientDetail customerId={client.customer_id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
