"use client";

import { useState, useMemo } from "react";
import { PredictionCard } from "@/components/predictions/prediction-card";
import { VerticalFilter } from "@/components/predictions/vertical-filter";
import { MessageSquare } from "lucide-react";

interface PredictionData {
  id: string;
  vertical: string;
  prediction_date: string;
  contact_date: string | null;
  message_text: string | null;
  confidence_score: number | null;
  priority: number;
  status: string;
  metadata: Record<string, unknown> | null;
  customer_id: string;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    last_purchase_date: string | null;
  };
}

export interface ClientRanking {
  customer_id: string;
  total_revenue: number;
}

type SortOption = "urgentes" | "importantes" | "potencial" | "recientes";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "urgentes", label: "Mas urgentes" },
  { value: "importantes", label: "Clientes mas importantes" },
  { value: "potencial", label: "Mayor monto potencial" },
  { value: "recientes", label: "Mas recientes" },
];

export function ContactarContent({
  predictions,
  rankings,
}: {
  predictions: PredictionData[];
  rankings: ClientRanking[];
}) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("urgentes");

  // Map para lookup O(1) de revenue por customer_id
  const revenueMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rankings) {
      map.set(r.customer_id, Number(r.total_revenue));
    }
    return map;
  }, [rankings]);

  const filtered = activeFilter
    ? predictions.filter((p) => p.vertical === activeFilter)
    : predictions;

  // Ordenar segun opcion seleccionada
  const sorted = useMemo(() => {
    const items = [...filtered];
    switch (sortBy) {
      case "urgentes":
        items.sort((a, b) => a.priority - b.priority);
        break;
      case "importantes":
        items.sort(
          (a, b) =>
            (revenueMap.get(b.customer_id) ?? 0) -
            (revenueMap.get(a.customer_id) ?? 0)
        );
        break;
      case "potencial":
        items.sort((a, b) => {
          const scoreA =
            (a.confidence_score ?? 0) * (revenueMap.get(a.customer_id) ?? 0);
          const scoreB =
            (b.confidence_score ?? 0) * (revenueMap.get(b.customer_id) ?? 0);
          return scoreB - scoreA;
        });
        break;
      case "recientes":
        items.sort(
          (a, b) =>
            new Date(b.prediction_date).getTime() -
            new Date(a.prediction_date).getTime()
        );
        break;
    }
    return items;
  }, [filtered, sortBy, revenueMap]);

  const pending = sorted.filter((p) => p.status === "pending");
  const contacted = sorted.filter((p) => p.status === "contacted");

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactar Hoy</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
            {contacted.length > 0 &&
              ` | ${contacted.length} contactado${contacted.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {predictions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <VerticalFilter
            predictions={predictions}
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {activeFilter
              ? "No hay predicciones para este filtro"
              : "No hay predicciones para hoy"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            El motor genera predicciones cada dia a las 5 AM
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              prediction={{
                ...prediction,
                status: prediction.status as "pending" | "contacted" | "ignored",
                customer: Array.isArray(prediction.customer)
                  ? (prediction.customer as unknown as PredictionData["customer"][])[0]
                  : prediction.customer,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
