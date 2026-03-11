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
  a_contactar: "bg-slate-500/20 text-slate-300",
  contactado: "bg-blue-500/20 text-blue-400",
  en_seguimiento: "bg-amber-500/20 text-amber-400",
  por_cotizar: "bg-purple-500/20 text-purple-400",
  cotizacion_enviada: "bg-indigo-500/20 text-indigo-400",
  vendido: "bg-green-500/20 text-green-400",
};

/** Verticales del motor de predicciones */
export type Vertical = "reposicion" | "activacion" | "cross_sell" | "recuperacion";

/** Colores por vertical */
export const VERTICAL_STYLES: Record<Vertical, { label: string; color: string }> = {
  reposicion: { label: "Reposicion", color: "bg-blue-500/20 text-blue-400" },
  activacion: { label: "Activacion", color: "bg-green-500/20 text-green-400" },
  cross_sell: { label: "Cross-sell", color: "bg-purple-500/20 text-purple-400" },
  recuperacion: { label: "Recuperacion", color: "bg-amber-500/20 text-amber-400" },
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

/** Etapas de origen para followups (de donde se creo el seguimiento) */
export type OriginStage = "contactado" | "por_cotizar" | "cotizacion_enviada";

/** Secuencias de followup diferenciadas por etapa de origen */
export const ORIGIN_SEQUENCES: Record<"por_cotizar" | "cotizacion_enviada", number[]> = {
  por_cotizar: [1, 3, 5],         // Agresivo — cliente ya mostro interes
  cotizacion_enviada: [2, 4, 7],   // Moderado — insistir pero sin presionar
};

/** Timers por etapa: dias antes de auto-mover a "en_seguimiento" */
export const STAGE_TIMERS: Partial<Record<ColumnName, number>> = {
  contactado: 2,
  por_cotizar: 1,
  cotizacion_enviada: 1,
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
  /** Cache de copies de venta por etapa. Keys: en_seguimiento, por_cotizar, cotizacion_enviada */
  stage_messages: Record<string, string>;
  /** Fecha limite de la etapa actual (NULL si la etapa no tiene timer) */
  stage_deadline: string | null;
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
    next_reposition_estimate: string | null;
    metadata: {
      stock_alert?: {
        products_without_stock: string[];
        products_with_stock: Record<string, number>;
      };
      [key: string]: unknown;
    } | null;
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
  origin_stage: OriginStage | null;
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

/** Notificacion de followup (push in-app) */
export interface FollowupNotification {
  id: string;
  followup_id: string;
  title: string;
  body: string;
  scheduled_at: string;
}

export interface PipelineGetResponse {
  cards: PipelineCard[];
  notifications: FollowupNotification[];
}

export interface PipelineResponse {
  success: boolean;
  message?: string;
  cards_synced?: number;
  card?: PipelineCard;
}

export interface PipelineErrorResponse {
  error: string;
}
