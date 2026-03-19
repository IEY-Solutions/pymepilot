"use client";

import { ListChecks, CheckCircle2, X } from "lucide-react";
import type { KeyAccountAlert } from "@/lib/key-accounts/types";

interface Props {
  actions: KeyAccountAlert[];
  onAction: () => void;
}

export function DetailActions({ actions, onAction }: Props) {
  const handleResolve = async (alertId: string) => {
    await fetch("/api/key-accounts/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", alert_id: alertId }),
    });
    onAction();
  };

  const handleDismiss = async (alertId: string) => {
    await fetch("/api/key-accounts/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", alert_id: alertId }),
    });
    onAction();
  };

  // Ordenar: vencidas primero
  const sorted = [...actions].sort((a, b) => {
    const dateA = a.trigger_date ? new Date(a.trigger_date).getTime() : Infinity;
    const dateB = b.trigger_date ? new Date(b.trigger_date).getTime() : Infinity;
    return dateA - dateB;
  });

  const now = new Date();

  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60 flex items-center gap-1.5">
        <ListChecks className="h-3.5 w-3.5" />
        Acciones pendientes
      </h3>

      {sorted.length === 0 ? (
        <p className="text-xs text-white/30">Sin acciones pendientes</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((action) => {
            const isOverdue = action.trigger_date && new Date(action.trigger_date) < now;
            return (
              <div
                key={action.id}
                className={`flex items-start gap-2 p-2 rounded ${
                  isOverdue ? "bg-red-500/10" : "bg-white/[0.03]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isOverdue ? "text-red-400" : "text-white"}`}>
                    {action.title}
                  </p>
                  {action.trigger_date && (
                    <p className={`text-[10px] mt-0.5 ${isOverdue ? "text-red-400/60" : "text-white/30"}`}>
                      {isOverdue ? "Vencida: " : "Vence: "}
                      {new Date(action.trigger_date).toLocaleDateString("es-AR")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleResolve(action.id)}
                    className="p-1 rounded text-white/30 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                    title="Completar"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDismiss(action.id)}
                    className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                    title="Descartar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
