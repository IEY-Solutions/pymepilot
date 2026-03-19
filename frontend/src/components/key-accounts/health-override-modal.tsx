"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { HealthScore } from "@/lib/key-accounts/types";
import { HEALTH_COLORS } from "@/lib/key-accounts/types";

interface Props {
  accountId: string;
  currentHealth: HealthScore;
  hasOverride: boolean;
  onChanged: () => void;
  onClose: () => void;
}

export function HealthOverrideModal({
  accountId,
  currentHealth,
  hasOverride,
  onChanged,
  onClose,
}: Props) {
  const [saving, setSaving] = useState(false);

  const handleOverride = async (color: HealthScore) => {
    setSaving(true);
    try {
      const res = await fetch("/api/key-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_health_override",
          account_id: accountId,
          health_override: color,
        }),
      });
      if (res.ok) onChanged();
    } catch {
      alert("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/key-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_auto_health",
          account_id: accountId,
        }),
      });
      if (res.ok) onChanged();
    } catch {
      alert("Error de conexion");
    } finally {
      setSaving(false);
    }
  };

  const colors: HealthScore[] = ["green", "yellow", "red"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-dark w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-base font-semibold text-white">Semaforo de salud</h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-white/50">
            Forzar un color manualmente. Se mantiene hasta que lo liberes.
          </p>

          {/* Botones de color */}
          <div className="flex gap-2 justify-center">
            {colors.map((color) => {
              const config = HEALTH_COLORS[color];
              const isActive = currentHealth === color;
              return (
                <button
                  key={color}
                  onClick={() => handleOverride(color)}
                  disabled={saving}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 ${
                    isActive
                      ? `${config.bg} ring-1 ring-white/20`
                      : "bg-white/[0.06] hover:bg-white/[0.1]"
                  }`}
                >
                  <div className={`h-3 w-3 rounded-full ${config.dot}`} />
                  <span className="text-sm text-white">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* Restaurar automatico */}
          {hasOverride && (
            <button
              onClick={handleRestore}
              disabled={saving}
              className="w-full py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                "Liberar override (volver a automatico)"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
