"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RankingRow } from "./metricas-content";
import { ClientDetail } from "./client-detail";

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diff = Math.floor(
    (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff}d`;
}

export function ClientRankingTable({
  rankings,
}: {
  rankings: RankingRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (rankings.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
        Sin datos de ranking. Se calculan con el primer refresh de vistas
        materializadas.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header — visible en desktop */}
      <div className="hidden md:grid md:grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem_5rem] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500">
        <span>#</span>
        <span>Cliente</span>
        <span className="text-right">Facturac.</span>
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
              className="w-full text-left hover:bg-gray-50 transition-colors"
            >
              {/* Vista desktop */}
              <div className="hidden md:grid md:grid-cols-[3rem_1fr_6rem_5rem_5rem_5rem_5rem] gap-2 px-4 py-3 items-center border-b border-gray-100">
                <span className="text-sm font-medium text-gray-400">
                  {client.ranking}
                </span>
                <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  {client.name}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </span>
                <span className="text-sm text-gray-700 text-right">
                  {formatCurrency(Number(client.total_revenue))}
                </span>
                <span className="text-sm text-gray-700 text-right">
                  {client.total_orders}
                </span>
                <span className="text-sm text-gray-700 text-right">
                  {formatCurrency(Number(client.avg_ticket))}
                </span>
                <span className="text-sm text-gray-500 text-right">
                  {daysAgo(client.last_purchase)}
                </span>
                <span className="text-sm text-gray-500 text-right">
                  {client.avg_days_between_purchases
                    ? `~${Math.round(Number(client.avg_days_between_purchases))}d`
                    : "—"}
                </span>
              </div>

              {/* Vista mobile — compacta */}
              <div className="md:hidden px-4 py-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 w-6">
                      #{client.ranking}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {client.name}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
                <div className="flex gap-4 mt-1 ml-8 text-xs text-gray-500">
                  <span>{formatCurrency(Number(client.total_revenue))}</span>
                  <span>{client.total_orders} compras</span>
                  <span>{daysAgo(client.last_purchase)}</span>
                </div>
              </div>
            </button>

            {/* Panel expandible */}
            {isExpanded && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <ClientDetail customerId={client.customer_id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
