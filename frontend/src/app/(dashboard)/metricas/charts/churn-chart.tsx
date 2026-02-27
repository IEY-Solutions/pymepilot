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
import type { ChurnRow } from "../metricas-content";

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

export function ChurnChart({ data }: { data: ChurnRow[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Churn mensual
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 12 }}
            width={45}
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Churn"]}
          />
          {/* Zona verde < 10%, amarilla 10-15%, roja > 15% */}
          <ReferenceLine
            y={10}
            stroke="#22c55e"
            strokeDasharray="3 3"
            label={{ value: "10%", position: "right", fontSize: 10 }}
          />
          <ReferenceLine
            y={15}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: "15%", position: "right", fontSize: 10 }}
          />
          <Line
            type="monotone"
            dataKey="churn"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 4, fill: "#ef4444" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
