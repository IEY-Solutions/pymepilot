"use client";

import { useState } from "react";
import { Bell, CheckCircle2, X } from "lucide-react";
import type { KeyAccountAlert } from "@/lib/key-accounts/types";

interface Props {
  alerts: KeyAccountAlert[];
  onAction: () => void;
}

export function DetailAlerts({ alerts, onAction }: Props) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    try {
      const res = await fetch("/api/key-accounts/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", alert_id: alertId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Error al resolver la alerta");
        return;
      }
      setErrorMsg(null);
      onAction();
    } catch {
      setErrorMsg("Error de conexion al resolver la alerta");
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      const res = await fetch("/api/key-accounts/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", alert_id: alertId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? "Error al descartar la alerta");
        return;
      }
      setErrorMsg(null);
      onAction();
    } catch {
      setErrorMsg("Error de conexion al descartar la alerta");
    }
  };

  return (
    <div className="bg-white/[0.03] rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-white/60 flex items-center gap-1.5">
        <Bell className="h-3.5 w-3.5" />
        Alertas activas
      </h3>

      {errorMsg && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{errorMsg}</p>
      )}

      {alerts.length === 0 ? (
        <p className="text-xs text-white/30">Sin alertas activas</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2 p-2 rounded bg-white/[0.03]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{alert.title}</p>
                {alert.description && (
                  <p className="text-xs text-white/40 mt-0.5">{alert.description}</p>
                )}
                <p className="text-[10px] text-white/30 mt-1">
                  {alert.alert_type === "temporal" ? "Temporal" : alert.alert_type === "behavioral" ? "Comportamiento" : "Manual"}
                  {alert.trigger_date && (
                    <> · {new Date(alert.trigger_date).toLocaleDateString("es-AR")}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleResolve(alert.id)}
                  className="p-1 rounded text-white/30 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                  title="Resolver"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                  title="Descartar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
