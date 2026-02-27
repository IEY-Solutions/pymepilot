"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

export function TicketChart({ data }: { data: TicketRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Ticket promedio
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 12 }}
            width={55}
          />
          <Tooltip
            formatter={(value) => `$${Number(value).toLocaleString("es-AR")}`}
          />
          <Legend />
          <Bar dataKey="Recurrente" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Nuevo" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
