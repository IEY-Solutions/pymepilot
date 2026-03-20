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
import type { TicketRow } from "../metricas-content";
import { formatCurrency, formatMonthShort } from "@/lib/format";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

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
            style={{ backgroundColor: entry.fill }}
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

export function TicketChart({ data }: { data: TicketRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8 text-center text-white/40 text-sm">
        Sin datos de ticket
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonthShort(d.month),
    Recurrente: Number(d.avg_ticket_recurring) || 0,
    Nuevo: Number(d.avg_ticket_new) || 0,
  }));

  return (
    <div className="bg-[#1a2a2c] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          Ticket promedio
          <InfoTooltip text={TOOLTIPS["metricas.chart_ticket"]} />
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          Valor promedio por compra, recurrente vs nuevo
        </p>
      </div>
      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="text-xs text-white/50">Recurrente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-white/50">Nuevo</span>
        </div>
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
          <Bar dataKey="Recurrente" fill="#81b5a1" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Nuevo" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
