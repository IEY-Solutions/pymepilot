"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus } from "lucide-react";
import type { KeyAccount } from "@/lib/key-accounts/types";
import { HEALTH_SORT_ORDER } from "@/lib/key-accounts/types";
import { KeyAccountCard } from "./key-account-card";
import { AddKeyAccountModal } from "./add-key-account-modal";
import { KeyAccountDetail } from "./key-account-detail";
import { PendingAlertsBanner } from "./pending-alerts-banner";

interface Props {
  initialAccounts: KeyAccount[];
}

export function KeyAccountsGrid({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<KeyAccount[]>(initialAccounts);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const refreshAccounts = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/key-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts ?? []);
      }
    } catch (err) {
      console.error("Error refreshing key accounts:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // L-05: El fetch en mount es necesario aunque page.tsx pase initialAccounts via SSR.
  // Razon: initialAccounts tiene el health_score almacenado en DB, pero NO el recalculado.
  // La RPC recalculate_key_account_health_scores corre en el GET /api/key-accounts y
  // actualiza los semaforos segun el estado actual (compras, alertas, facturacion).
  // Sin este fetch, los semaforos muestran el valor del dia anterior hasta que el usuario
  // hace click en "Actualizar". El SSR solo sirve para el first paint sin semaforos.
  useEffect(() => {
    refreshAccounts();
  }, [refreshAccounts]);

  // Ordenamiento: rojos → amarillos → verdes, dentro por ultima interaccion (mas antiguo primero)
  const sortedAccounts = [...accounts].sort((a, b) => {
    const healthDiff = HEALTH_SORT_ORDER[a.health_score] - HEALTH_SORT_ORDER[b.health_score];
    if (healthDiff !== 0) return healthDiff;

    // Dentro del mismo color: sin interaccion primero, luego mas antiguo
    const dateA = a.last_note_date ? new Date(a.last_note_date).getTime() : 0;
    const dateB = b.last_note_date ? new Date(b.last_note_date).getTime() : 0;
    return dateA - dateB; // mas antiguo primero
  });

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cuentas Clave</h1>
          <p className="text-sm text-white/50 mt-1">
            {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"} activas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAccounts}
            disabled={refreshing}
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>
      </div>

      {/* Banner de alertas pendientes */}
      {sortedAccounts.length > 0 && (
        <PendingAlertsBanner
          accounts={sortedAccounts}
          onOpenAccount={(id) => setSelectedAccountId(id)}
        />
      )}

      {/* Grilla de tarjetas */}
      {sortedAccounts.length === 0 ? (
        <div className="glass-dark p-8 text-center">
          <p className="text-white/50 mb-2">No tenes cuentas clave todavia</p>
          <p className="text-white/30 text-sm mb-4">
            Agrega tus clientes mas importantes para hacer seguimiento relacional
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Agregar cuenta clave
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sortedAccounts.map((account) => (
            <KeyAccountCard
              key={account.id}
              account={account}
              onClick={() => setSelectedAccountId(account.id)}
            />
          ))}
        </div>
      )}

      {/* Modal agregar */}
      {showAddModal && (
        <AddKeyAccountModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            refreshAccounts();
          }}
        />
      )}

      {/* Detalle */}
      {selectedAccount && (
        <KeyAccountDetail
          account={selectedAccount}
          onClose={() => setSelectedAccountId(null)}
          onRefresh={refreshAccounts}
        />
      )}
    </div>
  );
}
