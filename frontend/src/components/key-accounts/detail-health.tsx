"use client";

import { Settings } from "lucide-react";
import type { KeyAccount } from "@/lib/key-accounts/types";
import { HEALTH_COLORS } from "@/lib/key-accounts/types";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

interface Props {
  account: KeyAccount;
  onOverrideClick: () => void;
}

export function DetailHealth({ account, onOverrideClick }: Props) {
  const effectiveHealth = account.health_override ?? account.health_score;
  const color = HEALTH_COLORS[effectiveHealth];

  return (
    <div className={`rounded-lg p-3 flex items-center justify-between ${color.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`h-4 w-4 rounded-full ${color.dot}`} />
        <div>
          <span className="text-sm font-medium text-white">{color.label}</span>
          {account.health_override && (
            <span className="text-xs text-white/40 ml-2">(manual)</span>
          )}
          <InfoTooltip text={TOOLTIPS["cuentas_clave.semaforo"]} />
        </div>
      </div>
      <button
        onClick={onOverrideClick}
        className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        title="Configurar semaforo"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}
