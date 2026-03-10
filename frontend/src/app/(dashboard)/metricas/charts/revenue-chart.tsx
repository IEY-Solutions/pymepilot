"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { RevenueRow } from "../metricas-content";
import { formatCurrency } from "@/lib/format";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2a2c]/95 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-lg border border-white/[0.06] px-4 py-3">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-white/60">{entry.dataKey}</span>
          <span className="text-sm font-semibold text-white ml-auto">
            ${Number(entry.value).toLocaleString("es-AR")}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenueRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center text-white/40 text-sm">
        Sin datos de facturacion
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    Total: Number(d.total_revenue),
    Recurrente: Number(d.recurring_revenue),
    Nueva: Number(d.new_revenue),
  }));

  return (
    <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          Facturacion mensual
          <InfoTooltip text={TOOLTIPS["metricas.chart_revenue"]} />
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          Total, recurrente y nueva facturacion por mes
        </p>
      </div>
      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="text-xs text-white/50">Total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-white/50">Recurrente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-white/50">Nueva</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(129,181,161,0.1)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
            axisLine={{ stroke: "rgba(129,181,161,0.2)" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
            width={60}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={CustomTooltip} />
          <Line
            type="monotone"
            dataKey="Total"
            stroke="#81b5a1"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#81b5a1", strokeWidth: 2, stroke: "#1a2a2c" }}
            activeDot={{ r: 6, fill: "#81b5a1", strokeWidth: 2, stroke: "#1a2a2c" }}
          />
          <Line
            type="monotone"
            dataKey="Recurrente"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981", strokeWidth: 2, stroke: "#1a2a2c" }}
            activeDot={{ r: 5, fill: "#10b981", strokeWidth: 2, stroke: "#1a2a2c" }}
          />
          <Line
            type="monotone"
            dataKey="Nueva"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 2, stroke: "#1a2a2c" }}
            activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#1a2a2c" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
