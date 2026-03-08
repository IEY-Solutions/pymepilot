// =============================================================================
// Tipos del Pipeline CRM
// =============================================================================
// Cada tipo corresponde a una tabla en la DB (041_pipeline.sql).
// Los enums se mantienen sincronizados con los CHECK constraints de SQL.
// =============================================================================

/** Columnas del Kanban — orden visual de izquierda a derecha */
export type ColumnName =
  | "a_contactar"
  | "contactado"
  | "en_seguimiento"
  | "por_cotizar"
  | "cotizacion_enviada"
  | "vendido";

/** Orden de las columnas para renderizar el board */
export const COLUMN_ORDER: ColumnName[] = [
  "a_contactar",
  "contactado",
  "en_seguimiento",
  "por_cotizar",
  "cotizacion_enviada",
  "vendido",
];

/** Labels legibles para cada columna */
export const COLUMN_LABELS: Record<ColumnName, string> = {
  a_contactar: "A contactar",
  contactado: "Contactado",
  en_seguimiento: "En seguimiento",
  por_cotizar: "Por cotizar",
  cotizacion_enviada: "Cotizacion enviada",
  vendido: "Vendido",
};

/** Colores de cada columna (header del Kanban) */
export const COLUMN_COLORS: Record<ColumnName, string> = {
  a_contactar: "bg-slate-100 text-slate-700",
  contactado: "bg-blue-100 text-blue-700",
  en_seguimiento: "bg-amber-100 text-amber-700",
  por_cotizar: "bg-purple-100 text-purple-700",
  cotizacion_enviada: "bg-indigo-100 text-indigo-700",
  vendido: "bg-green-100 text-green-700",
};

/** Verticales del motor de predicciones */
export type Vertical = "reposicion" | "activacion" | "cross_sell" | "recuperacion";

/** Colores por vertical (consistente con prediction-card.tsx) */
export const VERTICAL_STYLES: Record<Vertical, { label: string; color: string }> = {
  reposicion: { label: "Reposicion", color: "bg-blue-100 text-blue-700" },
  activacion: { label: "Activacion", color: "bg-green-100 text-green-700" },
  cross_sell: { label: "Cross-sell", color: "bg-purple-100 text-purple-700" },
  recuperacion: { label: "Recuperacion", color: "bg-amber-100 text-amber-700" },
};

/** Resultado de contacto */
export type ContactResult = "contesto" | "no_contesto" | "pidio_cotizacion";

/** Secuencias de seguimiento por vertical (dias desde el contacto) */
export const FOLLOWUP_SEQUENCES: Record<Vertical, [number, number, number]> = {
  reposicion: [2, 5, 10],
  activacion: [1, 3, 7],
  recuperacion: [3, 7, 15],
  cross_sell: [2, 5, 10],
};

/** Card del pipeline con datos del cliente embebidos */
export interface PipelineCard {
  id: string;
  tenant_id: string;
  prediction_id: string | null;
  customer_id: string;
  column_name: ColumnName;
  vertical: Vertical;
  priority: number;
  is_expired: boolean;
  stage_message_text: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
  };
  prediction?: {
    message_text: string | null;
    confidence_score: number | null;
  } | null;
  followups: Followup[];
  latest_note: ContactNote | null;
}

/** Seguimiento programado */
export interface Followup {
  id: string;
  card_id: string;
  sequence_number: number;
  scheduled_date: string;
  status: "pending" | "completed" | "skipped";
  completed_at: string | null;
}

/** Nota de contacto */
export interface ContactNote {
  id: string;
  card_id: string;
  result: ContactResult;
  note_text: string | null;
  followup_id: string | null;
  created_at: string;
}

// =============================================================================
// Tipos de API request/response
// =============================================================================

export interface PipelineSyncRequest {
  action: "sync";
}

export interface PipelineMoveRequest {
  action: "move";
  card_id: string;
  to_column: ColumnName;
}

export interface PipelineContactRequest {
  action: "contact";
  card_id: string;
  result: ContactResult;
  note_text?: string;
}

export interface PipelineFollowupRequest {
  action: "complete_followup";
  card_id: string;
  followup_id: string;
  result: ContactResult;
  note_text?: string;
}

export interface PipelineDiscardRequest {
  action: "discard";
  card_id: string;
}

export type PipelineRequest =
  | PipelineSyncRequest
  | PipelineMoveRequest
  | PipelineContactRequest
  | PipelineFollowupRequest
  | PipelineDiscardRequest;

export interface PipelineResponse {
  success: boolean;
  message?: string;
  cards_synced?: number;
  card?: PipelineCard;
}

export interface PipelineErrorResponse {
  error: string;
}
