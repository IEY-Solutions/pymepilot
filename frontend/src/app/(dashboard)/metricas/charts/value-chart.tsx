"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { ValueRow } from "../metricas-content";
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
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
        <span className="text-sm text-white/60">Valor atribuido</span>
        <span className="text-sm font-semibold text-white ml-auto">
          ${Number(payload[0]?.value ?? 0).toLocaleString("es-AR")}
        </span>
      </div>
    </div>
  );
}

export function ValueChart({ data }: { data: ValueRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center text-white/40 text-sm">
        Sin conversiones atribuidas aun. El valor aparecera cuando las
        predicciones se conviertan en ventas.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    valor: Number(d.attributed_value),
    conversiones: Number(d.predictions_converted),
  }));

  return (
    <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          Valor generado por PymePilot
          <InfoTooltip text={TOOLTIPS["metricas.chart_value"]} />
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          Facturacion atribuida a predicciones convertidas
        </p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
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
            width={55}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={CustomTooltip} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="valor" fill="#81b5a1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
