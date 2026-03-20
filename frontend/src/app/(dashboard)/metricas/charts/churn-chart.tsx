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
import { formatMonthShort } from "@/lib/format";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

function CustomTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const churnVal = Number(payload[0]?.value ?? 0);
  return (
    <div className="bg-[#1a2a2c]/95 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-lg border border-white/[0.06] px-4 py-3">
      <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
        <span className="text-sm text-white/60">Churn</span>
        <span className="text-sm font-semibold text-white ml-auto">
          {churnVal.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function ChurnChart({ data }: { data: ChurnRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center text-white/40 text-sm">
        Sin datos de churn
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonthShort(d.month),
    churn: Number(d.churn_rate),
    churned: Number(d.churned),
    active_prev: Number(d.active_prev),
  }));

  return (
    <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          Churn mensual
          <InfoTooltip text={TOOLTIPS["metricas.chart_churn"]} />
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
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
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12, fill: "rgba(255,255,255,0.5)" }}
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
            dot={{ r: 4, fill: "#ef4444", strokeWidth: 2, stroke: "#1a2a2c" }}
            activeDot={{ r: 6, fill: "#ef4444", strokeWidth: 2, stroke: "#1a2a2c" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
