"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import type { KeyAccount } from "@/lib/key-accounts/types";

interface PendingAlert {
  alertId: string;
  accountId: string;
  accountName: string;
  title: string;
  triggerDate: string;
  isOverdue: boolean;
  isToday: boolean;
}

interface Props {
  accounts: KeyAccount[];
  onResolve: (alertId: string) => void;
  onOpenAccount: (accountId: string) => void;
}

export function PendingAlertsBanner({ accounts, onResolve, onOpenAccount }: Props) {
  // Este componente necesita alertas detalladas que no vienen en el GET principal.
  // Por ahora mostramos un resumen basado en los contadores que ya tenemos.
  // Las alertas con detalle se ven dentro del perfil de cada cuenta.

  const accountsWithPendingActions = accounts.filter(
    (a) => a.pending_actions_count > 0
  );

  const accountsWithoutFollowup = accounts.filter(
    (a) => !a.has_future_alert && a.notes_count > 0
  );

  if (accountsWithPendingActions.length === 0 && accountsWithoutFollowup.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Acciones pendientes */}
      {accountsWithPendingActions.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">
              Acciones pendientes
            </span>
          </div>
          <div className="space-y-1.5">
            {accountsWithPendingActions.map((account) => (
              <button
                key={account.id}
                onClick={() => onOpenAccount(account.id)}
                className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-sm text-white/70">{account.customer.name}</span>
                <span className="text-xs text-orange-400">
                  {account.pending_actions_count}{" "}
                  {account.pending_actions_count === 1 ? "accion" : "acciones"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sin seguimiento */}
      {accountsWithoutFollowup.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">
              Sin seguimiento programado
            </span>
          </div>
          <div className="space-y-1.5">
            {accountsWithoutFollowup.map((account) => (
              <button
                key={account.id}
                onClick={() => onOpenAccount(account.id)}
                className="w-full text-left flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/[0.04] transition-colors"
              >
                <span className="text-sm text-white/70">{account.customer.name}</span>
                <span className="text-xs text-amber-400">Programar</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
