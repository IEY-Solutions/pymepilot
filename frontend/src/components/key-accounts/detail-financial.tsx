"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { FinancialSummary } from "@/lib/key-accounts/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  financials: FinancialSummary[];
}

export function DetailFinancial({ financials }: Props) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60">Resumen financiero</h3>

      {financials.length === 0 ? (
        <p className="text-xs text-white/30">Sin datos de facturacion</p>
      ) : (
        <div className="space-y-2">
          {financials.map((f) => (
            <div
              key={f.month_label}
              className="flex items-center justify-between text-sm"
            >
              <div>
                <span className="text-white/70">{f.month_label}</span>
                <span className="text-white/40 ml-2 text-xs">
                  {f.order_count} {f.order_count === 1 ? "pedido" : "pedidos"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">
                  {formatCurrency(f.month_revenue)}
                </span>
                {f.trend_pct !== 0 && (
                  <span
                    className={`flex items-center gap-0.5 text-xs ${
                      f.trend_pct > 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {f.trend_pct > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(f.trend_pct)}%
                  </span>
                )}
                {f.trend_pct === 0 && (
                  <Minus className="h-3 w-3 text-white/30" />
                )}
              </div>
            </div>
          ))}

          {/* Ticket promedio del mes mas reciente */}
          {financials[0] && (
            <div className="pt-2 border-t border-white/5 text-xs text-white/40">
              Ticket promedio: {formatCurrency(financials[0].avg_ticket)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
