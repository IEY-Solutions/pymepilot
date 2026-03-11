"use client";

import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/format";

export interface ProductRankingRow {
  product_id: string;
  product_name: string;
  product_sku: string;
  total_units: number;
  total_revenue: number;
}

interface Props {
  products: ProductRankingRow[];
}

type SortBy = "revenue" | "units";

export function ProductRankingTable({ products }: Props) {
  const [sortBy, setSortBy] = useState<SortBy>("revenue");

  const sorted = useMemo(() => {
    const copy = [...products];
    if (sortBy === "units") {
      copy.sort((a, b) => Number(b.total_units) - Number(a.total_units));
    } else {
      copy.sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue));
    }
    return copy;
  }, [products, sortBy]);

  const maxValue = sorted.length > 0
    ? sortBy === "revenue"
      ? Number(sorted[0].total_revenue)
      : Number(sorted[0].total_units)
    : 0;

  if (products.length === 0) {
    return (
      <div className="bg-[#1a2a2c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center">
        <p className="text-white/50">Sin datos de productos</p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a2a2c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
      {/* Toggle */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
          Ranking de productos ({products.length})
        </h3>
        <div className="flex gap-1 bg-white/[0.06] rounded-lg p-0.5">
          <button
            onClick={() => setSortBy("revenue")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              sortBy === "revenue"
                ? "bg-[#1a2a2c] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Por monto
          </button>
          <button
            onClick={() => setSortBy("units")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              sortBy === "units"
                ? "bg-[#1a2a2c] text-white shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Por unidades
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="divide-y divide-white/[0.06]">
        {sorted.map((p, i) => {
          const barValue = sortBy === "revenue" ? Number(p.total_revenue) : Number(p.total_units);
          const pct = maxValue > 0 ? Math.round((barValue / maxValue) * 100) : 0;

          return (
            <div key={p.product_id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors">
              {/* Ranking */}
              <span className={`text-sm font-bold w-7 text-right shrink-0 ${
                i === 0 ? "text-amber-500" : i === 1 ? "text-white/40" : i === 2 ? "text-amber-400" : "text-white/30"
              }`}>
                {i + 1}
              </span>

              {/* Product info + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-white truncate">{p.product_name || "Producto sin nombre"}</span>
                  {p.product_sku && (
                    <span className="text-[10px] text-white/40 shrink-0">{p.product_sku}</span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-white/[0.06] rounded-full mt-1.5">
                  <div
                    className="h-full bg-[#81b5a1] rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Values */}
              <div className="flex gap-4 text-xs shrink-0">
                <span className={`font-medium ${sortBy === "units" ? "text-white" : "text-white/40"}`}>
                  {Number(p.total_units).toLocaleString("es-AR")} uds
                </span>
                <span className={`font-medium ${sortBy === "revenue" ? "text-white" : "text-white/40"}`}>
                  {formatCurrency(Number(p.total_revenue))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
