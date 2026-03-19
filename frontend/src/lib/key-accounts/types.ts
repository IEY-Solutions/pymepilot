// =============================================================================
// Tipos de Cuentas Clave (Key Account Management)
// =============================================================================
// Cada tipo corresponde a una tabla en la DB (054_key_accounts.sql).
// Los enums se mantienen sincronizados con los CHECK constraints de SQL.
// =============================================================================

/** Estado del semaforo de salud */
export type HealthScore = "green" | "yellow" | "red";

/** Estado de la cuenta clave */
export type KeyAccountStatus = "active" | "archived";

/** Tipo de nota */
export type NoteType = "meeting" | "call" | "promise" | "observation";

/** Tipo de alerta */
export type AlertType = "temporal" | "behavioral" | "manual";

/** Estado de una alerta */
export type AlertStatus = "pending" | "triggered" | "dismissed" | "resolved";

/** Colores del semaforo */
export const HEALTH_COLORS: Record<HealthScore, { bg: string; dot: string; label: string }> = {
  green: { bg: "bg-green-500/15", dot: "bg-green-500", label: "Saludable" },
  yellow: { bg: "bg-yellow-500/15", dot: "bg-yellow-500", label: "Atencion" },
  red: { bg: "bg-red-500/15", dot: "bg-red-500", label: "Critico" },
};

/** Orden de prioridad del semaforo (rojos primero) */
export const HEALTH_SORT_ORDER: Record<HealthScore, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

/** Configuracion visual por tipo de nota */
export const NOTE_TYPE_CONFIG: Record<NoteType, { label: string; icon: string }> = {
  meeting: { label: "Reunion", icon: "Users" },
  call: { label: "Llamada", icon: "Phone" },
  promise: { label: "Promesa", icon: "Handshake" },
  observation: { label: "Observacion", icon: "Eye" },
};

/** Cuenta clave con datos del cliente embebidos */
export interface KeyAccount {
  id: string;
  tenant_id: string;
  customer_id: string;
  status: KeyAccountStatus;
  health_score: HealthScore;
  health_override: HealthScore | null;
  source: "manual" | "suggested";
  notes_count: number;
  pending_actions_count: number;
  created_at: string;
  created_by: string | null;
  // Relaciones
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    total_purchases_amount: number | null;
    last_purchase_date: string | null;
  };
  // Datos calculados en el GET
  last_note_date: string | null;
  last_note_type: NoteType | null;
  active_alerts_count: number;
  has_future_alert: boolean;
}

/** Nota de interaccion */
export interface KeyAccountNote {
  id: string;
  key_account_id: string;
  note_type: NoteType;
  content: string;
  created_by: string | null;
  created_at: string;
}

/** Alerta o accion pendiente */
export interface KeyAccountAlert {
  id: string;
  key_account_id: string;
  alert_type: AlertType;
  title: string;
  description: string | null;
  trigger_rule: string | null;
  trigger_date: string | null;
  status: AlertStatus;
  source_note_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** Resumen financiero de un mes */
export interface FinancialSummary {
  month_label: string;
  month_revenue: number;
  order_count: number;
  avg_ticket: number;
  trend_pct: number;
}

/** Producto top de un cliente */
export interface TopProduct {
  product_name: string;
  total_quantity: number;
  total_revenue: number;
  times_ordered: number;
}

/** Sugerencia de cuenta clave */
export interface KeyAccountSuggestion {
  customer_id: string;
  customer_name: string;
  total_amount: number;
  order_count: number;
}

// =============================================================================
// Tipos de API request/response
// =============================================================================

export interface KeyAccountsGetResponse {
  accounts: KeyAccount[];
}

export interface KeyAccountsErrorResponse {
  error: string;
}

export interface KeyAccountsActionResponse {
  success: boolean;
  message?: string;
  account?: KeyAccount;
  needs_followup?: boolean;
}
