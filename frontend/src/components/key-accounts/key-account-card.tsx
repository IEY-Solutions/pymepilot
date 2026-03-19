"use client";

import { Phone, Mail, Clock, AlertTriangle, Bell, Trash2 } from "lucide-react";
import type { KeyAccount } from "@/lib/key-accounts/types";
import { HEALTH_COLORS, NOTE_TYPE_CONFIG } from "@/lib/key-accounts/types";
import { formatCurrency } from "@/lib/format";

interface Props {
  account: KeyAccount;
  onClick: () => void;
  onDelete: () => void;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Sin interaccion";
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Hace 1 dia";
  return `Hace ${diff} dias`;
}

export function KeyAccountCard({ account, onClick, onDelete }: Props) {
  const health = HEALTH_COLORS[account.health_score];
  const effectiveHealth = account.health_override
    ? HEALTH_COLORS[account.health_override]
    : health;

  return (
    <div
      className="glass-dark p-4 space-y-3 cursor-pointer hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(129,181,161,0.1)] transition-shadow"
      onClick={onClick}
    >
      {/* Header: semaforo + nombre */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <div className={`h-3.5 w-3.5 rounded-full ${effectiveHealth.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-white truncate">
            {account.customer.name}
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {account.customer.total_purchases_amount
              ? formatCurrency(account.customer.total_purchases_amount)
              : "Sin facturacion"}
          </p>
        </div>
        {account.health_override && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/10 text-white/40">
            Manual
          </span>
        )}
        <button
          className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Eliminar cuenta clave"
          aria-label="Eliminar cuenta clave"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Contadores */}
      <div className="flex items-center gap-3 text-xs text-white/40">
        {account.active_alerts_count > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            <Bell className="h-3 w-3" />
            {account.active_alerts_count}
          </span>
        )}
        {account.notes_count > 0 && (
          <span>
            {account.notes_count} {account.notes_count === 1 ? "nota" : "notas"}
          </span>
        )}
        {account.pending_actions_count > 0 && (
          <span className="text-orange-400">
            {account.pending_actions_count} {account.pending_actions_count === 1 ? "accion" : "acciones"}
          </span>
        )}
      </div>

      {/* Sin seguimiento */}
      {!account.has_future_alert && account.notes_count > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>Sin seguimiento programado</span>
        </div>
      )}

      {/* Footer: ultima interaccion + contacto rapido */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        {account.last_note_type && (
          <span className="text-white/30">
            {NOTE_TYPE_CONFIG[account.last_note_type]?.label}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {timeAgo(account.last_note_date ?? account.customer.last_purchase_date)}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {account.customer.phone && (
            <a
              href={`tel:${account.customer.phone}`}
              className="hover:text-[#81b5a1]"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-3 w-3" />
            </a>
          )}
          {account.customer.email && (
            <a
              href={`mailto:${account.customer.email}`}
              className="hover:text-[#81b5a1]"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
