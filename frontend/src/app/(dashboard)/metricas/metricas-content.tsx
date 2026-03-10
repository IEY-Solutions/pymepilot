"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Zap,
  Download,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { RevenueChart } from "./charts/revenue-chart";
import { ChurnChart } from "./charts/churn-chart";
import { TicketChart } from "./charts/ticket-chart";
import { ValueChart } from "./charts/value-chart";
import { ClientRankingTable } from "./client-ranking-table";
import { ProductRankingTable, type ProductRankingRow } from "./product-ranking-table";
import { formatCurrency } from "@/lib/format";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

// ============================================================
// TIPOS
// ============================================================

export interface RevenueRow {
  month: string;
  total_revenue: number;
  recurring_revenue: number;
  new_revenue: number;
  recurring_pct: number;
}

export interface ChurnRow {
  month: string;
  active_prev: number;
  churned: number;
  churn_rate: number;
}

export interface TicketRow {
  month: string;
  avg_ticket: number;
  avg_ticket_recurring: number;
  avg_ticket_new: number;
}

export interface ValueRow {
  month: string;
  attributed_value: number;
  predictions_converted: number;
}

export interface SalesRow {
  month: string;
  total_orders: number;
  total_revenue: number;
}

export interface RankingRow {
  customer_id: string;
  name: string;
  total_orders: number;
  total_revenue: number;
  avg_ticket: number;
  last_purchase: string;
  avg_days_between_purchases: number | null;
  ranking: number;
  trend: "up" | "down" | "stable";
}

interface MetricasContentProps {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  sales: SalesRow[];
  rankings: RankingRow[];
  productRankings: ProductRankingRow[];
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
  tooltip,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
          {tooltip && <InfoTooltip text={tooltip} />}
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

export function MetricasContent({
  revenue,
  churn,
  ticket,
  value,
  sales,
  rankings,
  productRankings,
}: MetricasContentProps) {
  const [activeTab, setActiveTab] = useState<"rendimiento" | "clientes" | "productos" | "comparar">(
    "rendimiento"
  );
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleExportExcel() {
    setExporting(true);
    setShowExport(false);
    const { exportToExcel } = await import("./exports/export-excel");
    exportToExcel({ revenue, churn, ticket, value, rankings });
    setExporting(false);
  }

  async function handleExportPdf() {
    setExporting(true);
    setShowExport(false);
    const { exportToPdf } = await import("./exports/export-pdf");
    await exportToPdf({ revenue, churn, ticket, value, rankings });
    setExporting(false);
  }

  // KPI cards: ultimo mes disponible
  const lastRevenue = revenue.length > 0 ? revenue[revenue.length - 1] : null;
  const lastChurn = churn.length > 0 ? churn[churn.length - 1] : null;
  const lastTicket = ticket.length > 0 ? ticket[ticket.length - 1] : null;
  const totalValue = value.reduce((sum, v) => sum + Number(v.attributed_value), 0);
  const totalConverted = value.reduce(
    (sum, v) => sum + Number(v.predictions_converted),
    0
  );

  // Tendencia: comparar ultimo mes con penultimo
  const prevRevenue = revenue.length > 1 ? revenue[revenue.length - 2] : null;
  const recurringTrend =
    lastRevenue && prevRevenue
      ? Number(lastRevenue.recurring_pct) - Number(prevRevenue.recurring_pct)
      : 0;

  const prevChurn = churn.length > 1 ? churn[churn.length - 2] : null;
  const churnTrend =
    lastChurn && prevChurn
      ? Number(lastChurn.churn_rate) - Number(prevChurn.churn_rate)
      : 0;

  // Ventas del mes: ultimo vs penultimo
  const lastSales = sales.length > 0 ? sales[sales.length - 1] : null;
  const prevSales = sales.length > 1 ? sales[sales.length - 2] : null;
  const salesPctChange =
    lastSales && prevSales && Number(prevSales.total_orders) > 0
      ? ((Number(lastSales.total_orders) - Number(prevSales.total_orders)) /
          Number(prevSales.total_orders)) *
        100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header con tabs + exportar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Metricas</h1>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("rendimiento")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "rendimiento"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Rendimiento
            </button>
            <button
              onClick={() => setActiveTab("clientes")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "clientes"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Clientes
            </button>
            <button
              onClick={() => setActiveTab("productos")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "productos"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Productos
            </button>
            <button
              onClick={() => setActiveTab("comparar")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "comparar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Comparar
            </button>
          </div>

          {/* Dropdown exportar */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExport(!showExport)}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">
                {exporting ? "Exportando..." : "Exportar"}
              </span>
              <ChevronDown className="h-3 w-3" />
            </button>

            {showExport && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                <button
                  onClick={handleExportExcel}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                >
                  Descargar Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportPdf}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100"
                >
                  Descargar PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab: Rendimiento */}
      {activeTab === "rendimiento" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-5">
            <KpiCard
              title="Ventas del mes"
              value={
                lastSales
                  ? `${Number(lastSales.total_orders)} ordenes`
                  : "—"
              }
              subtitle={
                lastSales
                  ? `${formatCurrency(Number(lastSales.total_revenue))}${
                      prevSales
                        ? ` | ${salesPctChange > 0 ? "+" : ""}${salesPctChange.toFixed(0)}% vs ant.`
                        : ""
                    }`
                  : "Sin datos"
              }
              icon={Receipt}
              color={
                salesPctChange >= 0
                  ? "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600"
                  : "bg-gradient-to-br from-red-50 to-red-100 text-red-600"
              }
              tooltip={TOOLTIPS["metricas.ventas_mes"]}
            />
            <KpiCard
              title="% Recurrente"
              value={
                lastRevenue
                  ? `${Number(lastRevenue.recurring_pct).toFixed(0)}%`
                  : "—"
              }
              subtitle={
                recurringTrend !== 0
                  ? `${recurringTrend > 0 ? "+" : ""}${recurringTrend.toFixed(1)}pp vs mes ant.`
                  : "Sin comparacion"
              }
              icon={recurringTrend >= 0 ? TrendingUp : TrendingDown}
              color={
                recurringTrend >= 0
                  ? "bg-gradient-to-br from-green-50 to-green-100 text-green-600"
                  : "bg-gradient-to-br from-red-50 to-red-100 text-red-600"
              }
              tooltip={TOOLTIPS["metricas.recurrente"]}
            />
            <KpiCard
              title="Churn"
              value={
                lastChurn
                  ? `${Number(lastChurn.churn_rate).toFixed(0)}%`
                  : "—"
              }
              subtitle={
                churnTrend !== 0
                  ? `${churnTrend > 0 ? "+" : ""}${churnTrend.toFixed(1)}pp vs mes ant.`
                  : "Sin comparacion"
              }
              icon={churnTrend <= 0 ? TrendingDown : TrendingUp}
              color={
                Number(lastChurn?.churn_rate ?? 0) <= 10
                  ? "bg-gradient-to-br from-green-50 to-green-100 text-green-600"
                  : Number(lastChurn?.churn_rate ?? 0) <= 15
                    ? "bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600"
                    : "bg-gradient-to-br from-red-50 to-red-100 text-red-600"
              }
              tooltip={TOOLTIPS["metricas.churn"]}
            />
            <KpiCard
              title="Ticket promedio"
              value={
                lastTicket
                  ? formatCurrency(Number(lastTicket.avg_ticket))
                  : "—"
              }
              subtitle={
                lastTicket
                  ? `Rec: ${formatCurrency(Number(lastTicket.avg_ticket_recurring || 0))} / Nuevo: ${formatCurrency(Number(lastTicket.avg_ticket_new || 0))}`
                  : "Sin datos"
              }
              icon={ShoppingCart}
              color="bg-gradient-to-br from-purple-50 to-purple-100 text-purple-600"
              tooltip={TOOLTIPS["metricas.ticket"]}
            />
            <KpiCard
              title="Valor PymePilot"
              value={formatCurrency(totalValue)}
              subtitle={
                totalConverted > 0
                  ? `${totalConverted} predicciones convertidas`
                  : "Sin conversiones aun"
              }
              icon={Zap}
              color="bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600"
              tooltip={TOOLTIPS["metricas.valor_pymepilot"]}
            />
          </div>

          {/* Graficos */}
          <div className="space-y-5">
            {/* Revenue chart — full width */}
            <RevenueChart data={revenue} />

            {/* Churn + Ticket — 2 columnas en desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <ChurnChart data={churn} />
              <TicketChart data={ticket} />
            </div>

            {/* Value chart — full width */}
            <ValueChart data={value} />
          </div>
        </div>
      )}

      {/* Tab: Clientes */}
      {activeTab === "clientes" && (
        <ClientRankingTable rankings={rankings} />
      )}

      {/* Tab: Productos */}
      {activeTab === "productos" && (
        <ProductRankingTable products={productRankings} />
      )}

      {/* Tab: Comparar */}
      {activeTab === "comparar" && (
        <CompareTab revenue={revenue} churn={churn} ticket={ticket} value={value} sales={sales} />
      )}
    </div>
  );
}

// ============================================================
// COMPARE TAB
// ============================================================

type CompareType = "month" | "quarter" | "custom";
type CompareRange = 4 | 6 | 9 | 12;

function CompareTab({
  revenue,
  churn,
  ticket,
  value,
  sales,
}: {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  sales: SalesRow[];
}) {
  const [compareType, setCompareType] = useState<CompareType>("month");
  const [compareRange, setCompareRange] = useState<CompareRange>(6);

  // Calcular periodos segun tipo de comparacion
  const { current, previous } = useMemo(() => {
    if (compareType === "month") {
      // Ultimo mes vs penultimo
      return {
        current: { revenue: revenue.slice(-1), churn: churn.slice(-1), ticket: ticket.slice(-1), value: value.slice(-1), sales: sales.slice(-1), label: "Ultimo mes" },
        previous: { revenue: revenue.slice(-2, -1), churn: churn.slice(-2, -1), ticket: ticket.slice(-2, -1), value: value.slice(-2, -1), sales: sales.slice(-2, -1), label: "Mes anterior" },
      };
    } else if (compareType === "quarter") {
      // Ultimos 3 meses vs 3 meses anteriores
      return {
        current: { revenue: revenue.slice(-3), churn: churn.slice(-3), ticket: ticket.slice(-3), value: value.slice(-3), sales: sales.slice(-3), label: "Ultimo trimestre" },
        previous: { revenue: revenue.slice(-6, -3), churn: churn.slice(-6, -3), ticket: ticket.slice(-6, -3), value: value.slice(-6, -3), sales: sales.slice(-6, -3), label: "Trimestre anterior" },
      };
    }
    // Custom: todo el rango disponible dividido en 2 mitades
    const half = Math.floor(revenue.length / 2);
    return {
      current: { revenue: revenue.slice(half), churn: churn.slice(half), ticket: ticket.slice(half), value: value.slice(half), sales: sales.slice(half), label: `Ultimos ${revenue.length - half}m` },
      previous: { revenue: revenue.slice(0, half), churn: churn.slice(0, half), ticket: ticket.slice(0, half), value: value.slice(0, half), sales: sales.slice(0, half), label: `${half}m anteriores` },
    };
  }, [compareType, compareRange, revenue, churn, ticket, value, sales]);

  // Helpers para promediar/sumar arrays
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avgField = (rows: any[], field: string) => {
    if (rows.length === 0) return 0;
    return rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r[field] ?? 0), 0) / rows.length;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sumField = (rows: any[], field: string) => {
    return rows.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r[field] ?? 0), 0);
  };

  // KPIs comparativos
  const kpis = [
    {
      label: "Ventas (ordenes)",
      currentVal: sumField(current.sales, "total_orders"),
      previousVal: sumField(previous.sales, "total_orders"),
      format: (v: number) => `${v.toLocaleString("es-AR")} ordenes`,
      invertColor: false,
    },
    {
      label: "Facturacion",
      currentVal: sumField(current.sales, "total_revenue"),
      previousVal: sumField(previous.sales, "total_revenue"),
      format: (v: number) => formatCurrency(v),
      invertColor: false,
    },
    {
      label: "% Recurrente",
      currentVal: avgField(current.revenue, "recurring_pct"),
      previousVal: avgField(previous.revenue, "recurring_pct"),
      format: (v: number) => `${v.toFixed(0)}%`,
      invertColor: false,
      isPp: true,
    },
    {
      label: "Churn",
      currentVal: avgField(current.churn, "churn_rate"),
      previousVal: avgField(previous.churn, "churn_rate"),
      format: (v: number) => `${v.toFixed(1)}%`,
      invertColor: true, // menor churn es mejor
      isPp: true,
    },
    {
      label: "Ticket promedio",
      currentVal: avgField(current.ticket, "avg_ticket"),
      previousVal: avgField(previous.ticket, "avg_ticket"),
      format: (v: number) => formatCurrency(v),
      invertColor: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Selectores */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {([["month", "Mes vs anterior"], ["quarter", "Trimestre vs anterior"], ["custom", "Periodo custom"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setCompareType(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                compareType === val
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {compareType === "custom" && (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {([4, 6, 9, 12] as const).map((months) => (
              <button
                key={months}
                onClick={() => setCompareRange(months)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  compareRange === months
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {months}m
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabla KPIs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-3">Metrica</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-3">{current.label}</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-3">{previous.label}</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider text-gray-400 px-5 py-3">Variacion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {kpis.map((kpi) => {
              const diff = kpi.currentVal - kpi.previousVal;
              const pctChange = kpi.previousVal !== 0
                ? ((kpi.currentVal - kpi.previousVal) / Math.abs(kpi.previousVal)) * 100
                : 0;
              const isPositive = kpi.invertColor ? diff <= 0 : diff >= 0;

              return (
                <tr key={kpi.label} className="hover:bg-gray-50">
                  <td className="text-sm font-medium text-gray-700 px-5 py-3">{kpi.label}</td>
                  <td className="text-sm text-right text-gray-900 font-semibold px-5 py-3">{kpi.format(kpi.currentVal)}</td>
                  <td className="text-sm text-right text-gray-500 px-5 py-3">{kpi.format(kpi.previousVal)}</td>
                  <td className={`text-sm text-right font-medium px-5 py-3 ${isPositive ? "text-green-600" : "text-red-600"}`}>
                    {diff > 0 ? "+" : ""}{kpi.isPp ? `${diff.toFixed(1)}pp` : `${pctChange.toFixed(0)}%`}
                    {" "}{isPositive ? "↑" : "↓"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Graficos con overlay */}
      <div className="space-y-5">
        <RevenueChart data={revenue} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChurnChart data={churn} />
          <TicketChart data={ticket} />
        </div>
        <ValueChart data={value} />
      </div>
    </div>
  );
}
