"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { ChurnRow } from "../metricas-content";

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const churnVal = Number(payload[0]?.value ?? 0);
  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-100 px-4 py-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-sm text-gray-600">Churn</span>
        <span className="text-sm font-semibold text-gray-900 ml-auto">
          {churnVal.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function ChurnChart({ data }: { data: ChurnRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
        Sin datos de churn
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    churn: Number(d.churn_rate),
    churned: Number(d.churned),
    active_prev: Number(d.active_prev),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">Churn mensual</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Porcentaje de clientes que dejan de comprar
        </p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f3f4f6"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            width={45}
            domain={[0, "auto"]}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={CustomTooltip} />
          <ReferenceLine
            y={10}
            stroke="#10b981"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            label={{
              value: "10%",
              position: "right",
              fontSize: 10,
              fill: "#10b981",
            }}
          />
          <ReferenceLine
            y={15}
            stroke="#ef4444"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
            label={{
              value: "15%",
              position: "right",
              fontSize: 10,
              fill: "#ef4444",
            }}
          />
          <Line
            type="monotone"
            dataKey="churn"
            stroke="#ef4444"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#ef4444", strokeWidth: 2, stroke: "#fff" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
