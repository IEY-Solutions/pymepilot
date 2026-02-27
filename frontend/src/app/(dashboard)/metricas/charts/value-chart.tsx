"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

export function ValueChart({ data }: { data: ValueRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Valor generado por PymePilot
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
            formatter={(value) => [
              `$${Number(value).toLocaleString("es-AR")}`,
              "Valor atribuido",
            ]}
          />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
            {chartData.map((_, index) => (
              <Cell key={index} fill="#6366f1" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
