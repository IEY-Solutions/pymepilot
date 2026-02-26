"use client";

import { useState } from "react";
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
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    last_purchase_date: string | null;
  };
}

export function ContactarContent({
  predictions,
}: {
  predictions: PredictionData[];
}) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const filtered = activeFilter
    ? predictions.filter((p) => p.vertical === activeFilter)
    : predictions;

  const pending = filtered.filter((p) => p.status === "pending");
  const contacted = filtered.filter((p) => p.status === "contacted");

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
        <div className="mb-4">
          <VerticalFilter
            predictions={predictions}
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
          />
        </div>
      )}

      {filtered.length === 0 ? (
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
          {filtered.map((prediction) => (
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
