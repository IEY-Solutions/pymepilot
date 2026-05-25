"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// TIPOS
// ============================================================

export interface DemandProjectionRow {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_rubro: string;
  projected_demand_30d: number;
  avg_monthly_units: number;
  trend_pct: number;
  unique_customers: number;
  top_customer_name: string;
  top_customer_units: number;
}

interface DemandDetailRow {
  customer_id: string;
  customer_name: string;
  last_order_date: string;
  last_quantity: number;
  avg_quantity: number;
  frequency_days: number | null;
  next_purchase_estimate: string | null;
  demand_estimate: number;
}

interface RubroGroup {
  rubro: string;
  products: DemandProjectionRow[];
  totalDemand: number;
  totalProducts: number;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function DemandProjectionTable({
  projections,
}: {
  projections: DemandProjectionRow[];
}) {
  const [expandedRubro, setExpandedRubro] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DemandDetailRow[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  // Agrupar por rubro
  const rubros = useMemo(() => {
    const map = new Map<string, DemandProjectionRow[]>();
    for (const p of projections) {
      const rubro = p.product_rubro || "Otros";
      if (!map.has(rubro)) map.set(rubro, []);
      map.get(rubro)!.push(p);
    }

    const groups: RubroGroup[] = [];
    for (const [rubro, products] of map) {
      groups.push({
        rubro,
        products,
        totalDemand: products.reduce((s, p) => s + Number(p.projected_demand_30d), 0),
        totalProducts: products.length,
      });
    }

    // Ordenar por demanda total descendente
    return groups.sort((a, b) => b.totalDemand - a.totalDemand);
  }, [projections]);

  async function toggleProduct(productId: string) {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    if (!details[productId]) {
      setLoadingDetail(productId);
      const supabase = createClient();
      const { data } = await supabase.rpc("get_demand_projection_detail", {
        p_product_id: productId,
      });
      setDetails((prev) => ({ ...prev, [productId]: data ?? [] }));
      setLoadingDetail(null);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  }

  if (projections.length === 0) {
    return (
      <div className="glass-dark rounded-2xl p-8 text-center">
        <Package className="h-12 w-12 mx-auto text-white/20 mb-3" />
        <p className="text-white/50 text-sm">
          Sin datos de demanda aun. Se calculara automaticamente cuando haya ordenes sincronizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rubros.map((rubro) => (
        <div
          key={rubro.rubro}
          className="bg-[#1a2a2c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden"
        >
          {/* Header del rubro */}
          <button
            onClick={() =>
              setExpandedRubro(expandedRubro === rubro.rubro ? null : rubro.rubro)
            }
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedRubro === rubro.rubro ? (
                <ChevronDown className="h-4 w-4 text-white/40" />
              ) : (
                <ChevronRight className="h-4 w-4 text-white/40" />
              )}
              <h3 className="text-sm font-semibold text-white">{rubro.rubro}</h3>
              <span className="text-xs text-white/30">
                {rubro.totalProducts} {rubro.totalProducts === 1 ? "producto" : "productos"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-white">
                {rubro.totalDemand.toLocaleString("es-AR")} uds
              </span>
              <span className="text-[10px] text-white/30 hidden sm:inline">prox. 30d</span>
            </div>
          </button>

          {/* Tabla de productos del rubro */}
          {expandedRubro === rubro.rubro && (
            <div className="border-t border-white/[0.06]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                      <th className="text-left px-4 py-2 w-8">#</th>
                      <th className="text-left px-4 py-2">Producto</th>
                      <th className="text-right px-4 py-2">Se van a necesitar</th>
                      <th className="text-right px-4 py-2 hidden sm:table-cell">Venta mensual</th>
                      <th className="text-center px-4 py-2 hidden md:table-cell">Tendencia</th>
                      <th className="text-right px-4 py-2 hidden md:table-cell">Clientes</th>
                      <th className="text-left px-4 py-2 hidden lg:table-cell">Mayor comprador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rubro.products.map((p, i) => (
                      <ProductRow
                        key={p.product_id}
                        product={p}
                        rank={i + 1}
                        isExpanded={expandedProduct === p.product_id}
                        isLoading={loadingDetail === p.product_id}
                        detail={details[p.product_id]}
                        onToggle={() => toggleProduct(p.product_id)}
                        formatDate={formatDate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// FILA DE PRODUCTO (expandible)
// ============================================================

function ProductRow({
  product,
  rank,
  isExpanded,
  isLoading,
  detail,
  onToggle,
  formatDate,
}: {
  product: DemandProjectionRow;
  rank: number;
  isExpanded: boolean;
  isLoading: boolean;
  detail?: DemandDetailRow[];
  onToggle: () => void;
  formatDate: (d: string | null) => string;
}) {
  const trend = Number(product.trend_pct);
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown;
  const trendColor =
    trend > 5
      ? "text-emerald-400"
      : trend < -5
        ? "text-red-400"
        : "text-white/40";

  return (
    <>
      <tr
        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-2.5 text-white/30 text-xs">{rank}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
            )}
            <div>
              <p className="text-sm text-white font-medium truncate max-w-[200px]">
                {product.product_name || "Producto sin nombre"}
              </p>
              {product.product_sku && (
                <p className="text-[10px] text-white/30">{product.product_sku}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-right">
          <span className="text-sm font-semibold text-white">
            {Number(product.projected_demand_30d).toLocaleString("es-AR")} uds
          </span>
        </td>
        <td className="px-4 py-2.5 text-right hidden sm:table-cell">
          <span className="text-sm text-white/60">
            {Number(product.avg_monthly_units).toLocaleString("es-AR")}
          </span>
        </td>
        <td className="px-4 py-2.5 text-center hidden md:table-cell">
          <span className={`inline-flex items-center gap-1 text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3" />
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}%
          </span>
        </td>
        <td className="px-4 py-2.5 text-right hidden md:table-cell">
          <span className="text-sm text-white/60">{Number(product.unique_customers)}</span>
        </td>
        <td className="px-4 py-2.5 hidden lg:table-cell">
          <span className="text-xs text-white/40 truncate max-w-[150px] inline-block">
            {product.top_customer_name || "—"}
            {product.top_customer_units > 0 && (
              <span className="text-white/20">
                {" "}({Number(product.top_customer_units)} uds)
              </span>
            )}
          </span>
        </td>
      </tr>

      {/* Detalle expandido: clientes */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-white/[0.02] px-4 py-3">
            {isLoading ? (
              <p className="text-xs text-white/30 text-center py-2">Cargando detalle...</p>
            ) : !detail || detail.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-2">Sin detalle disponible</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-white/30 text-[10px] uppercase tracking-wider">
                      <th className="text-left px-3 py-1.5">Cliente</th>
                      <th className="text-right px-3 py-1.5">Ult. fecha</th>
                      <th className="text-right px-3 py-1.5">Ultimo pedido</th>
                      <th className="text-right px-3 py-1.5">Pide en promedio</th>
                      <th className="text-right px-3 py-1.5 hidden sm:table-cell">Compra cada</th>
                      <th className="text-right px-3 py-1.5 hidden sm:table-cell">Vuelve aprox.</th>
                      <th className="text-right px-3 py-1.5">Va a necesitar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.map((d) => (
                      <tr key={d.customer_id} className="border-t border-white/[0.03]">
                        <td className="px-3 py-1.5 text-xs text-white/70 truncate max-w-[150px]">
                          {d.customer_name || "Cliente sin nombre"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white/40 text-right">
                          {formatDate(d.last_order_date)}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white/60 text-right">
                          {d.last_quantity} uds
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white/60 text-right">
                          {Number(d.avg_quantity)} uds
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white/40 text-right hidden sm:table-cell">
                          {d.frequency_days ? `${Number(d.frequency_days)} dias` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white/40 text-right hidden sm:table-cell">
                          {formatDate(d.next_purchase_estimate)}
                        </td>
                        <td className="px-3 py-1.5 text-xs text-white font-medium text-right">
                          {Number(d.demand_estimate)} uds
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
