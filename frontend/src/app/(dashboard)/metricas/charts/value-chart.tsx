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
import type { ValueRow } from "../metricas-content";

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
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
        <span className="text-sm text-gray-600">Valor atribuido</span>
        <span className="text-sm font-semibold text-gray-900 ml-auto">
          ${Number(payload[0]?.value ?? 0).toLocaleString("es-AR")}
        </span>
      </div>
    </div>
  );
}

export function ValueChart({ data }: { data: ValueRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400 text-sm">
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
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Valor generado por PymePilot
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
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
          <Bar dataKey="valor" fill="#6366f1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
