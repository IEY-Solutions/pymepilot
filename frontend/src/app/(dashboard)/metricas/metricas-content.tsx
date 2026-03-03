"use client";

import { useState, useRef, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Zap,
  Download,
  ChevronDown,
} from "lucide-react";
import { RevenueChart } from "./charts/revenue-chart";
import { ChurnChart } from "./charts/churn-chart";
import { TicketChart } from "./charts/ticket-chart";
import { ValueChart } from "./charts/value-chart";
import { ClientRankingTable } from "./client-ranking-table";
import { formatCurrency } from "@/lib/format";

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
  rankings: RankingRow[];
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
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
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
  rankings,
}: MetricasContentProps) {
  const [activeTab, setActiveTab] = useState<"rendimiento" | "clientes">(
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
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
    </div>
  );
}
