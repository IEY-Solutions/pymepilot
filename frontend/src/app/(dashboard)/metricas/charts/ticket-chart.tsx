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
import type { TicketRow } from "../metricas-content";

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-lg border border-gray-100 px-4 py-3">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-sm text-gray-600">{entry.dataKey}</span>
          <span className="text-sm font-semibold text-gray-900 ml-auto">
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
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
        Sin datos de ticket
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    Recurrente: Number(d.avg_ticket_recurring) || 0,
    Nuevo: Number(d.avg_ticket_new) || 0,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Ticket promedio
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Valor promedio por compra, recurrente vs nuevo
        </p>
      </div>
      <div className="flex flex-wrap gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="text-xs text-gray-500">Recurrente</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-500">Nuevo</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
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
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12, fill: "#9ca3af" }}
            width={55}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f9fafb" }} />
          <Bar dataKey="Recurrente" fill="#6366f1" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Nuevo" fill="#f59e0b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
