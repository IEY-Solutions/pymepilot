"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  times_ordered: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface ActivePrediction {
  vertical: string;
  prediction_date: string;
  status: string;
  message_text: string | null;
}

import { formatCurrency } from "@/lib/format";

function formatShortMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

const verticalLabels: Record<string, string> = {
  reposicion: "Reposicion",
  activacion: "Activacion",
  recuperacion: "Recuperacion",
  cross_sell: "Cross-Sell",
};

const verticalColors: Record<string, string> = {
  reposicion: "bg-blue-100 text-blue-700",
  activacion: "bg-emerald-100 text-emerald-700",
  recuperacion: "bg-amber-100 text-amber-700",
  cross_sell: "bg-purple-100 text-purple-700",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  contacted: "Contactado",
};

type ProductSortBy = "revenue" | "units";

export function ClientDetail({ customerId }: { customerId: string }) {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [predictions, setPredictions] = useState<ActivePrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [productSort, setProductSort] = useState<ProductSortBy>("revenue");

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    setError(false);

    Promise.all([
      supabase.rpc("get_client_top_products", {
        p_customer_id: customerId,
        p_limit: 10,
      }),
      supabase.rpc("get_client_monthly_revenue", {
        p_customer_id: customerId,
        p_months: 4,
      }),
      supabase
        .from("predictions")
        .select("vertical, prediction_date, status, message_text")
        .eq("customer_id", customerId)
        .in("status", ["pending", "contacted"])
        .order("prediction_date", { ascending: false })
        .limit(5),
    ]).then(([productsRes, revenueRes, predictionsRes]) => {
      // Si alguna RPC retorno error, tratarlo como fallo
      if (productsRes.error || revenueRes.error || predictionsRes.error) {
        setError(true);
        setLoading(false);
        return;
      }
      setProducts(productsRes.data ?? []);
      setMonthlyRevenue(revenueRes.data ?? []);
      setPredictions(predictionsRes.data ?? []);
      setLoading(false);
    }).catch(() => {
      setError(true);
      setLoading(false);
    });
  }, [customerId, retryCount]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-xs text-gray-400">Cargando detalle...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="text-xs text-red-500">Error al cargar detalle.</span>
        <button
          onClick={() => setRetryCount((c) => c + 1)}
          className="text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const hasProducts = products.length > 0;
  const hasRevenue = monthlyRevenue.length > 0;
  const hasPredictions = predictions.length > 0;

  if (!hasProducts && !hasRevenue && !hasPredictions) {
    return (
      <div className="text-xs text-gray-400 py-3">
        Sin datos registrados para este cliente
      </div>
    );
  }

  // Ordenar productos segun toggle
  const sortedProducts = hasProducts
    ? [...products].sort((a, b) =>
        productSort === "units"
          ? Number(b.total_quantity) - Number(a.total_quantity)
          : Number(b.total_revenue) - Number(a.total_revenue)
      )
    : [];

  const maxProductValue = sortedProducts.length > 0
    ? productSort === "units"
      ? Number(sortedProducts[0].total_quantity)
      : Number(sortedProducts[0].total_revenue)
    : 0;

  return (
    <div className="space-y-5">
      {/* Seccion 1: Top 10 productos */}
      {hasProducts && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Top {sortedProducts.length} productos
            </h4>
            <div className="flex gap-1 bg-surface-muted rounded p-0.5">
              <button
                onClick={() => setProductSort("revenue")}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  productSort === "revenue"
                    ? "bg-brand-600 text-brand-on-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Monto
              </button>
              <button
                onClick={() => setProductSort("units")}
                className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                  productSort === "units"
                    ? "bg-brand-600 text-brand-on-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Unidades
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {sortedProducts.map((p, i) => {
              const barValue = productSort === "units" ? Number(p.total_quantity) : Number(p.total_revenue);
              const pct =
                maxProductValue > 0
                  ? Math.round((barValue / maxProductValue) * 100)
                  : 0;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs font-medium text-gray-300 w-4 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-700 truncate block">
                      {p.product_name}
                    </span>
                    <div className="w-full h-1 bg-surface-muted rounded-full mt-1">
                      <div
                        className="h-full bg-indigo-400 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs shrink-0">
                    <span className={`font-medium ${productSort === "revenue" ? "text-gray-700" : "text-gray-400"}`}>
                      {formatCurrency(Number(p.total_revenue))}
                    </span>
                    <span className={`${productSort === "units" ? "font-medium text-gray-700" : "text-gray-400"}`}>
                      {Number(p.total_quantity)} uds
                    </span>
                    <span className="text-gray-400">{p.times_ordered}x</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seccion 2: Facturacion mensual — mini bar chart */}
      {hasRevenue && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Facturacion mensual
          </h4>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyRevenue.map((m) => ({
                  month: formatShortMonth(m.month),
                  revenue: Number(m.revenue),
                }))}
              >
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [
                    formatCurrency(Number(value ?? 0)),
                    "Facturacion",
                  ]}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#818cf8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Seccion 3: Predicciones activas */}
      {hasPredictions && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Predicciones activas
          </h4>
          <div className="space-y-2">
            {predictions.map((pred, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${verticalColors[pred.vertical] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {verticalLabels[pred.vertical] ?? pred.vertical}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(pred.prediction_date + "T12:00:00").toLocaleDateString("es-AR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    pred.status === "contacted"
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {statusLabels[pred.status] ?? pred.status}
                </span>
                {pred.message_text && (
                  <span className="text-xs text-gray-400 truncate max-w-[200px]">
                    {pred.message_text.slice(0, 60)}
                    {pred.message_text.length > 60 ? "..." : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
