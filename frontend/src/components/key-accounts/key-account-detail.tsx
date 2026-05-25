"use client";

import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import type {
  KeyAccount,
  KeyAccountNote,
  KeyAccountAlert,
  FinancialSummary,
  TopProduct,
} from "@/lib/key-accounts/types";
import { HEALTH_COLORS } from "@/lib/key-accounts/types";
import { DetailGeneral } from "./detail-general";
import { DetailFinancial } from "./detail-financial";
import { DetailHealth } from "./detail-health";
import { DetailAlerts } from "./detail-alerts";
import { DetailActions } from "./detail-actions";
import { DetailProducts } from "./detail-products";
import { DetailTimeline } from "./detail-timeline";
import { CreateNoteForm } from "./create-note-form";
import { FollowupNudge } from "./followup-nudge";
import { HealthOverrideModal } from "./health-override-modal";
import { createClient } from "@/lib/supabase/client";

interface Props {
  account: KeyAccount;
  onClose: () => void;
  onRefresh: () => void;
}

export function KeyAccountDetail({ account, onClose, onRefresh }: Props) {
  const [notes, setNotes] = useState<KeyAccountNote[]>([]);
  const [alerts, setAlerts] = useState<KeyAccountAlert[]>([]);
  const [financials, setFinancials] = useState<FinancialSummary[]>([]);
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [showHealthOverride, setShowHealthOverride] = useState(false);

  const effectiveHealth = account.health_override ?? account.health_score;
  const healthColor = HEALTH_COLORS[effectiveHealth];

  const fetchDetails = useCallback(async () => {
    const supabase = createClient();

    const [notesRes, alertsRes, financialRes, productsRes] = await Promise.all([
      fetch(`/api/key-accounts/notes?key_account_id=${account.id}`),
      fetch(`/api/key-accounts/alerts?key_account_id=${account.id}`),
      supabase.rpc("get_key_account_financial_summary", {
        p_customer_id: account.customer_id,
      }),
      supabase.rpc("get_client_top_products", {
        p_customer_id: account.customer_id,
        p_limit: 10,
      }),
    ]);

    if (notesRes.ok) {
      const data = await notesRes.json();
      setNotes(data.notes ?? []);
    }
    if (alertsRes.ok) {
      const data = await alertsRes.json();
      setAlerts(data.alerts ?? []);
    }
    if (financialRes.data) {
      setFinancials(financialRes.data as FinancialSummary[]);
    }
    if (productsRes.data) {
      setProducts(productsRes.data as TopProduct[]);
    }
  }, [account.id, account.customer_id]);

  useEffect(() => {
    void Promise.resolve().then(fetchDetails);
  }, [fetchDetails]);

  const handleNoteCreated = async (needsFollowup: boolean) => {
    setShowNoteForm(false);
    if (needsFollowup) {
      setShowNudge(true);
    }
    await fetchDetails();
    onRefresh();
  };

  const handleFollowupDone = async () => {
    setShowNudge(false);
    await fetchDetails();
    onRefresh();
  };

  const handleAlertAction = async () => {
    await fetchDetails();
    onRefresh();
  };

  const handleHealthChanged = async () => {
    setShowHealthOverride(false);
    onRefresh();
  };

  const handleArchive = async () => {
    if (!confirm("¿Seguro que queres archivar esta cuenta clave?")) return;

    const res = await fetch("/api/key-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive", account_id: account.id }),
    });

    if (res.ok) {
      onClose();
      onRefresh();
    }
  };

  // Separar alertas vs acciones pendientes
  const activeAlerts = alerts.filter(
    (a) => a.alert_type !== "manual" || !a.source_note_id
  );
  const pendingActions = alerts.filter(
    (a) => a.alert_type === "manual" && a.source_note_id
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start justify-center py-4 px-4 md:py-8">
        <div className="glass-dark w-full max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className={`h-4 w-4 rounded-full ${healthColor.dot}`} />
              <div>
                <h2 className="text-xl font-bold text-white">
                  {account.customer.name}
                </h2>
                <p className="text-sm text-white/40">{healthColor.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNoteForm(true)}
                className="px-3 py-1.5 rounded-lg bg-[#81b5a1]/15 text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors text-sm font-medium"
              >
                Nueva nota
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-4 md:p-6 space-y-4">
            {/* Nudge de seguimiento */}
            {showNudge && (
              <FollowupNudge
                keyAccountId={account.id}
                onDone={handleFollowupDone}
                onDismiss={() => setShowNudge(false)}
              />
            )}

            {/* Fila 1: General + Financiero (2 columnas en desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailGeneral account={account} />
              <DetailFinancial financials={financials} />
            </div>

            {/* Semaforo */}
            <DetailHealth
              account={account}
              onOverrideClick={() => setShowHealthOverride(true)}
            />

            {/* Fila 2: Alertas + Acciones (2 columnas en desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DetailAlerts
                alerts={activeAlerts}
                onAction={handleAlertAction}
              />
              <DetailActions
                actions={pendingActions}
                onAction={handleAlertAction}
              />
            </div>

            {/* Productos clave */}
            <DetailProducts products={products} />

            {/* Timeline */}
            <DetailTimeline notes={notes} />

            {/* Archivar */}
            <div className="pt-4 border-t border-white/10">
              <button
                onClick={handleArchive}
                className="text-xs text-white/30 hover:text-red-400 transition-colors"
              >
                Archivar cuenta clave
              </button>
            </div>
          </div>

          {/* Modal nota */}
          {showNoteForm && (
            <CreateNoteForm
              keyAccountId={account.id}
              onCreated={handleNoteCreated}
              onClose={() => setShowNoteForm(false)}
            />
          )}

          {/* Modal override semaforo */}
          {showHealthOverride && (
            <HealthOverrideModal
              accountId={account.id}
              currentHealth={effectiveHealth}
              hasOverride={!!account.health_override}
              onChanged={handleHealthChanged}
              onClose={() => setShowHealthOverride(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
