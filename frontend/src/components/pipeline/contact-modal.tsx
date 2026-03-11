"use client";

import { useState } from "react";
import {
  X, Phone, PhoneOff, FileText, MessageCircle, Send,
  CheckCircle2, XCircle, StickyNote, Mail, Copy, Check,
  Info, FileSpreadsheet, AlertTriangle,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import type {
  PipelineCard,
  ContactResult,
  Followup,
  ColumnName,
  ContactNote,
} from "@/lib/pipeline/types";
import { VERTICAL_STYLES, COLUMN_LABELS, STAGE_TIMERS } from "@/lib/pipeline/types";

// =============================================================================
// Props
// =============================================================================

interface Props {
  card: PipelineCard;
  /** Followup activo si estamos en "en_seguimiento" */
  activeFollowup?: Followup | null;
  /** Todas las notas de la card (para timeline) */
  allNotes: ContactNote[];
  /** Callbacks */
  onContactSubmit: (result: ContactResult, noteText: string) => Promise<void>;
  onFollowupSubmit: (result: ContactResult, noteText: string) => Promise<void>;
  onAddNote: (noteText: string) => Promise<void>;
  onAdvance: (toColumn: ColumnName, noteText: string) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onClose: () => void;
}

// =============================================================================
// Constantes
// =============================================================================

const CONTACT_RESULT_OPTIONS: { value: ContactResult; label: string; icon: typeof Phone; color: string }[] = [
  { value: "contesto", label: "Contesto", icon: Phone, color: "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25" },
  { value: "no_contesto", label: "No contesto", icon: PhoneOff, color: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25" },
  { value: "pidio_cotizacion", label: "Pidio cotizacion", icon: FileText, color: "bg-purple-500/15 text-purple-400 border-purple-500/30 hover:bg-purple-500/25" },
];

const RESULT_LABELS: Record<string, string> = {
  contesto: "Contesto",
  no_contesto: "No contesto",
  pidio_cotizacion: "Pidio cotizacion",
};

// =============================================================================
// Timeline component
// =============================================================================

function Timeline({
  notes,
  card,
  onDeleteNote,
}: {
  notes: ContactNote[];
  card: PipelineCard;
  onDeleteNote: (noteId: string) => void;
}) {
  // Construir eventos: notas + creacion de la card
  const events: { id: string | null; date: string; label: string; note: string | null; type: "note" | "created" }[] = [];

  for (const n of notes) {
    const followup = n.followup_id
      ? card.followups.find((f) => f.id === n.followup_id)
      : null;

    const label = followup
      ? `Seguimiento ${followup.sequence_number}: ${RESULT_LABELS[n.result] ?? n.result}`
      : `Contacto: ${RESULT_LABELS[n.result] ?? n.result}`;

    events.push({ id: n.id, date: n.created_at, label, note: n.note_text, type: "note" });
  }

  // Evento de creacion
  events.push({
    id: null,
    date: card.created_at,
    label: "Creado por PymePilot",
    note: null,
    type: "created",
  });

  // Ordenar más reciente primero
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) return null;

  return (
    <div className="space-y-0">
      {events.map((event, i) => (
        <div key={event.id ?? "created"} className="flex gap-2.5 pb-3 last:pb-0 group/event">
          {/* Linea vertical */}
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
              event.type === "created" ? "bg-white/30" : "bg-[#81b5a1]"
            }`} />
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-[rgba(129,181,161,0.1)] mt-1" />
            )}
          </div>
          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/80">{event.label}</span>
              <span className="text-[10px] text-white/40">{formatRelativeDate(event.date)}</span>
              {event.type === "note" && event.id && (
                <button
                  onClick={() => onDeleteNote(event.id!)}
                  className="opacity-0 group-hover/event:opacity-100 text-white/30 hover:text-red-400 transition-all ml-auto"
                  title="Borrar nota"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {event.note && (
              <p className="text-xs text-white/50 mt-0.5 italic">{event.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatRelativeDate(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff} dias`;
}

// =============================================================================
// Mensaje sugerido con botón copiar
// =============================================================================

function SuggestedMessage({ card }: { card: PipelineCard }) {
  const [copied, setCopied] = useState(false);

  // Buscar copy cacheado para la etapa actual, fallback a prediction.message_text
  const stageMessage = card.stage_messages?.[card.column_name] ?? null;
  const originalMessage = stageMessage ?? card.prediction?.message_text ?? null;
  const isStageMessage = !!stageMessage;

  // En "a_contactar" el mensaje es editable — el vendedor puede ajustarlo
  // antes de copiarlo a WhatsApp
  const isEditable = card.column_name === "a_contactar";
  const [editedMessage, setEditedMessage] = useState(originalMessage ?? "");
  const message = isEditable ? editedMessage : originalMessage;

  if (!originalMessage) return null;

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      // Fallback para browsers sin clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleWhatsApp = async () => {
    await handleCopy();
    window.open("https://wa.me/", "_blank");
  };

  return (
    <div className="mx-4 mt-3 bg-white/[0.03] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-white/40" />
          <span className="text-[10px] font-medium text-white/50 uppercase tracking-wide">
            {isStageMessage ? "Mensaje sugerido para esta etapa" : "Mensaje original"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-white/40 hover:text-[#81b5a1] transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copiar
              </>
            )}
          </button>
          {isEditable && (
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1 text-[10px] font-medium text-green-400 hover:text-green-300 transition-colors"
            >
              <Send className="h-3 w-3" />
              WhatsApp
            </button>
          )}
        </div>
      </div>
      {isEditable ? (
        <textarea
          value={editedMessage}
          onChange={(e) => setEditedMessage(e.target.value)}
          className="w-full text-xs text-white/60 bg-[#1a2a2c] border border-[rgba(129,181,161,0.2)] rounded-md p-2 resize-none focus:ring-2 focus:ring-[#81b5a1] focus:border-[#81b5a1] outline-none"
          rows={4}
        />
      ) : (
        <p className="text-xs text-white/60 whitespace-pre-line">{message}</p>
      )}
    </div>
  );
}

// =============================================================================
// Plan de seguimiento
// =============================================================================

const ORIGIN_LABELS: Record<string, string> = {
  contactado: "post-contacto",
  por_cotizar: "post-cotizacion",
  cotizacion_enviada: "post-envio",
};

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00"); // Evitar timezone issues
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function FollowupPlan({ card }: { card: PipelineCard }) {
  const hasFollowups = card.followups.length > 0;
  const hasDeadline = !!card.stage_deadline;
  const isInSeguimiento = card.column_name === "en_seguimiento";
  const hasTimer = ["contactado", "por_cotizar", "cotizacion_enviada"].includes(card.column_name);

  // No mostrar plan si no hay nada que mostrar
  if (!hasFollowups && !hasDeadline && !hasTimer) return null;

  const today = new Date().toISOString().split("T")[0];
  const originLabel = card.followups[0]?.origin_stage
    ? ORIGIN_LABELS[card.followups[0].origin_stage] ?? ""
    : "";

  return (
    <div className="px-4 py-3">
      <p className="text-xs font-medium text-white/80 uppercase tracking-wide mb-2">Plan de seguimiento</p>
      <div className="space-y-0">
        {/* Para etapas con timer: mostrar evento actual + deadline */}
        {hasTimer && !isInSeguimiento && (
          <>
            <PlanStep
              label={`En ${COLUMN_LABELS[card.column_name]}`}
              date={formatDateShort(card.updated_at.split("T")[0])}
              completed={true}
            />
            {card.stage_deadline && (
              <PlanStep
                label={`Si no responde → pasa a seguimiento`}
                date={formatDateShort(card.stage_deadline)}
                completed={false}
                isOverdue={card.stage_deadline <= today}
              />
            )}
          </>
        )}

        {/* Para en_seguimiento: mostrar secuencia de followups */}
        {isInSeguimiento && hasFollowups && (
          <>
            {originLabel && (
              <div className="text-[10px] text-white/40 mb-1 italic">Origen: {originLabel}</div>
            )}
            {card.followups
              .sort((a, b) => a.sequence_number - b.sequence_number)
              .map((f) => (
                <PlanStep
                  key={f.id}
                  label={`Seguimiento ${f.sequence_number}`}
                  date={formatDateShort(f.scheduled_date)}
                  completed={f.status === "completed"}
                  isSkipped={f.status === "skipped"}
                  isOverdue={f.status === "pending" && f.scheduled_date <= today}
                  detail={f.status === "completed" && f.completed_at
                    ? `Completado ${formatDateShort(f.completed_at.split("T")[0])}`
                    : f.status === "pending" && f.scheduled_date === today
                      ? "Hoy"
                      : undefined}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}

function PlanStep({
  label,
  date,
  completed,
  isSkipped,
  isOverdue,
  detail,
}: {
  label: string;
  date: string;
  completed: boolean;
  isSkipped?: boolean;
  isOverdue?: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-2 h-2 rounded-full shrink-0 ${
        completed ? "bg-green-500" :
        isSkipped ? "bg-white/30" :
        isOverdue ? "bg-red-500" :
        "border-2 border-white/30"
      }`} />
      <span className={`text-xs ${
        completed ? "text-white/50 line-through" :
        isSkipped ? "text-white/40 line-through" :
        isOverdue ? "text-red-400 font-medium" :
        "text-white/80"
      }`}>
        {label} — {date}
      </span>
      {detail && (
        <span className="text-[10px] text-white/40 ml-auto">{detail}</span>
      )}
    </div>
  );
}

// =============================================================================
// Secciones de acciones por etapa
// =============================================================================

function ContactActions({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (result: ContactResult, note: string) => void;
  isSubmitting: boolean;
}) {
  const [selected, setSelected] = useState<ContactResult | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Resultado del contacto</p>
      <div className="flex gap-2">
        {CONTACT_RESULT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border text-xs font-medium transition-all ${
                isActive
                  ? `${opt.color} border-2 ring-1 ring-offset-1 ring-offset-[#1a2a2c] ring-current`
                  : "bg-white/[0.03] text-white/60 border-[rgba(129,181,161,0.1)] hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
      <NoteField value={note} onChange={setNote} />
      <SubmitButton
        disabled={!selected || isSubmitting}
        isSubmitting={isSubmitting}
        onClick={() => selected && onSubmit(selected, note)}
      />
    </div>
  );
}


function AdvanceActions({
  options,
  onSubmit,
  isSubmitting,
}: {
  options: { label: string; column: ColumnName; icon: typeof Send; color: string }[];
  onSubmit: (toColumn: ColumnName, note: string) => void;
  isSubmitting: boolean;
}) {
  const [selected, setSelected] = useState<ColumnName | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Siguiente paso</p>
      <div className="flex gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = selected === opt.column;
          return (
            <button
              key={opt.column}
              onClick={() => setSelected(opt.column)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 px-1.5 rounded-lg border text-xs font-medium transition-all ${
                isActive
                  ? `${opt.color} border-2 ring-1 ring-offset-1 ring-offset-[#1a2a2c] ring-current`
                  : "bg-white/[0.03] text-white/60 border-[rgba(129,181,161,0.1)] hover:bg-white/[0.06]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
      <NoteField value={note} onChange={setNote} />
      <SubmitButton
        disabled={!selected || isSubmitting}
        isSubmitting={isSubmitting}
        onClick={() => selected && onSubmit(selected, note)}
      />
    </div>
  );
}

// =============================================================================
// Componentes reutilizables
// =============================================================================

function NoteField({
  value,
  onChange,
  placeholder = "Nota opcional...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-[rgba(129,181,161,0.2)] rounded-lg p-2.5 text-sm resize-none h-16 bg-[#1a2a2c] text-white/80 placeholder:text-white/30 focus:ring-2 focus:ring-[#81b5a1] focus:border-[#81b5a1] outline-none"
      maxLength={500}
    />
  );
}

function SubmitButton({
  disabled,
  isSubmitting,
  label = "Confirmar",
  onClick,
}: {
  disabled: boolean;
  isSubmitting: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2 text-sm font-medium text-white bg-[#81b5a1] rounded-lg hover:bg-[#5a9a84] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isSubmitting ? "Guardando..." : label}
    </button>
  );
}

// =============================================================================
// Boton generar propuesta Excel
// =============================================================================

function ProposalButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.MouseEvent) {
    e.stopPropagation();
    setGenerating(true);
    setError(null);
    try {
      const { exportProposal } = await import("@/lib/exports/export-proposal");
      await exportProposal(customerId, customerName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al generar propuesta"
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-4 mt-3">
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="relative overflow-hidden w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm text-white bg-gradient-to-r from-[#81b5a1] to-[#5a9a84] hover:scale-[1.02] hover:shadow-[0_4px_20px_rgba(129,181,161,0.3)] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:hover:scale-100"
      >
        <span className="absolute inset-0 animate-[shimmer_2s_ease-in-out_0.5s_1_both] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <FileSpreadsheet className="h-4 w-4 relative" />
        <span className="relative">{generating ? "Generando..." : "Generar propuesta de reposicion"}</span>
      </button>
      {error && (
        <p className="text-xs text-red-400 mt-1.5 text-center">{error}</p>
      )}
    </div>
  );
}

// =============================================================================
// Modal principal
// =============================================================================

export function ContactModal({
  card,
  activeFollowup,
  allNotes,
  onContactSubmit,
  onFollowupSubmit,
  onAddNote,
  onAdvance,
  onDeleteNote,
  onClose,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const withLoading = async (fn: () => Promise<void>) => {
    setIsSubmitting(true);
    try {
      await fn();
    } finally {
      setIsSubmitting(false);
    }
  };

  const verticalStyle = VERTICAL_STYLES[card.vertical];
  const columnLabel = COLUMN_LABELS[card.column_name];
  const priorityLabel = card.priority <= 2 ? "Alta" : card.priority <= 3 ? "Media" : "Baja";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[#1a2a2c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] w-full max-w-md mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[rgba(129,181,161,0.1)] shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{card.customer.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${verticalStyle?.color ?? "bg-white/[0.06] text-white/80"}`}>
                  {verticalStyle?.label ?? card.vertical}
                </span>
                <span className="text-[10px] text-white/50">
                  Prioridad {priorityLabel}
                </span>
                <span className="text-[10px] text-white/40">
                  {columnLabel}
                  <InfoTooltip text={TOOLTIPS[`pipeline.${card.column_name}` as keyof typeof TOOLTIPS] ?? ""} />
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-white/40 hover:text-white/60 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Contacto */}
          <div className="flex gap-3 mt-2">
            {card.customer.phone && (
              <a href={`tel:${card.customer.phone}`} className="flex items-center gap-1 text-xs text-white/50 hover:text-[#81b5a1]">
                <Phone className="h-3 w-3" /> {card.customer.phone}
              </a>
            )}
            {card.customer.email && (
              <a href={`mailto:${card.customer.email}`} className="flex items-center gap-1 text-xs text-white/50 hover:text-[#81b5a1]">
                <Mail className="h-3 w-3" /> {card.customer.email}
              </a>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mensaje sugerido — stage_messages[etapa] o prediction.message_text */}
          <SuggestedMessage card={card} />

          {/* Boton generar propuesta — solo para reposicion */}
          {card.vertical === "reposicion" && (
            <ProposalButton
              customerId={card.customer_id}
              customerName={card.customer.name}
            />
          )}

          {/* Plan de seguimiento */}
          <FollowupPlan card={card} />

          {/* Stock alert — recordatorio de seguimiento */}
          {card.prediction?.metadata?.stock_alert?.products_without_stock?.length ? (
            <div className="mx-4 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <p className="text-xs font-medium text-amber-400">
                  Accion pendiente: Registrar seguimiento para ingreso de stock
                </p>
              </div>
              <p className="text-xs text-amber-300/70">
                Productos sin stock: {card.prediction.metadata.stock_alert.products_without_stock.join(", ")}
              </p>
              <p className="text-[10px] text-white/40">
                Cuando llegue stock, contactar a este cliente.
              </p>
            </div>
          ) : null}

          {/* Timeline de actividad */}
          {allNotes.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-white/80 uppercase tracking-wide mb-2">Actividad</p>
              <Timeline notes={allNotes} card={card} onDeleteNote={onDeleteNote} />
            </div>
          )}
        </div>

        {/* Acciones (fijas abajo) */}
        <div className="px-4 py-3 border-t border-[rgba(129,181,161,0.1)] bg-white/[0.03] shrink-0">
          {renderActions(card, activeFollowup, isSubmitting, withLoading, onContactSubmit, onFollowupSubmit, onAddNote, onAdvance)}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Banner de contexto por etapa
// =============================================================================

const STAGE_CONTEXT: Record<string, string> = {
  a_contactar: "Contacta a este cliente y registra como fue.",
  contactado: "Ya hiciste el primer contacto. Cuando el cliente responda, registra el resultado.",
  en_seguimiento: "El cliente no respondio. Segui la secuencia de seguimiento programada.",
  por_cotizar: "Este cliente pidio cotizacion. Enviala y avanza la card.",
  cotizacion_enviada: "Cotizacion enviada. Esperando respuesta del cliente.",
  vendido: "Venta cerrada. El ciclo del pipeline se completo.",
};

function StageContextBanner({ card, activeFollowup }: { card: PipelineCard; activeFollowup?: Followup | null }) {
  let text = STAGE_CONTEXT[card.column_name] ?? "";

  // En "en_seguimiento" con followup activo, mostrar detalle del seguimiento
  if (card.column_name === "en_seguimiento" && activeFollowup) {
    const total = card.followups.length;
    const completed = card.followups.filter((f) => f.status === "completed").length;
    const current = completed + 1;

    const today = new Date().toISOString().split("T")[0];
    const diffDays = Math.ceil(
      (new Date(activeFollowup.scheduled_date).getTime() - new Date(today).getTime()) / 86_400_000
    );
    const timing = diffDays <= 0 ? "hoy" : diffDays === 1 ? "manana" : `en ${diffDays} dias`;

    text = `Seguimiento ${current}/${total} — programado para ${timing}. Contacta al cliente y registra como fue.`;
  }

  if (!text) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-[#81b5a1]/10 rounded-lg mb-3">
      <Info className="h-3.5 w-3.5 text-[#81b5a1] mt-0.5 shrink-0" />
      <p className="text-xs text-[#a3cabb]">{text}</p>
    </div>
  );
}

// =============================================================================
// Renderizar acciones segun la etapa
// =============================================================================

function renderActions(
  card: PipelineCard,
  activeFollowup: Followup | null | undefined,
  isSubmitting: boolean,
  withLoading: (fn: () => Promise<void>) => Promise<void>,
  onContactSubmit: (result: ContactResult, noteText: string) => Promise<void>,
  onFollowupSubmit: (result: ContactResult, noteText: string) => Promise<void>,
  onAddNote: (noteText: string) => Promise<void>,
  onAdvance: (toColumn: ColumnName, noteText: string) => Promise<void>,
) {
  const banner = <StageContextBanner card={card} activeFollowup={activeFollowup} />;

  switch (card.column_name) {
    case "a_contactar":
      return (
        <>
          {banner}
          <ContactActions
            isSubmitting={isSubmitting}
            onSubmit={(result, note) => withLoading(() => onContactSubmit(result, note))}
          />
        </>
      );

    case "contactado":
      return (
        <>
          {banner}
          <ContactActions
            isSubmitting={isSubmitting}
            onSubmit={(result, note) => withLoading(() => onContactSubmit(result, note))}
          />
        </>
      );

    case "en_seguimiento":
      return (
        <>
          {banner}
          <ContactActions
            isSubmitting={isSubmitting}
            onSubmit={(result, note) => {
              if (activeFollowup) {
                withLoading(() => onFollowupSubmit(result, note));
              } else {
                withLoading(() => onContactSubmit(result, note));
              }
            }}
          />
        </>
      );

    case "por_cotizar":
      return (
        <>
          {banner}
          <AdvanceActions
            isSubmitting={isSubmitting}
            options={[
              { label: "Cotizacion enviada", column: "cotizacion_enviada", icon: Send, color: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25" },
              { label: "No avanza", column: "por_cotizar", icon: StickyNote, color: "bg-white/[0.06] text-white/60 border-[rgba(129,181,161,0.2)] hover:bg-white/[0.1]" },
            ]}
            onSubmit={(toColumn, note) => {
              if (toColumn === "por_cotizar") {
                withLoading(() => onAddNote(note));
              } else {
                withLoading(() => onAdvance(toColumn, note));
              }
            }}
          />
        </>
      );

    case "cotizacion_enviada":
      return (
        <>
          {banner}
          <AdvanceActions
            isSubmitting={isSubmitting}
            options={[
              { label: "Vendido", column: "vendido", icon: CheckCircle2, color: "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25" },
              { label: "Rechazada", column: "cotizacion_enviada", icon: XCircle, color: "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25" },
            ]}
            onSubmit={(toColumn, note) => {
              if (toColumn === "cotizacion_enviada") {
                withLoading(() => onAddNote(note));
              } else {
                withLoading(() => onAdvance(toColumn, note));
              }
            }}
          />
        </>
      );

    case "vendido": {
      const nextRepo = card.prediction?.next_reposition_estimate;
      return (
        <div className="space-y-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Venta cerrada</p>
            <p className="text-xs text-white/60">
              Excelente trabajo. Gracias a tu gestion y al seguimiento de PymePilot, cerraste otra operacion exitosa.
            </p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3 space-y-1">
            <p className="text-xs text-[#04a9ff] font-medium">
              Cliente en circuito de reposicion
            </p>
            <p className="text-[11px] text-white/50">
              PymePilot te avisara cuando sea momento de contactarlo de nuevo y programara la secuencia de seguimiento para generar otra venta.
            </p>
            {card.vertical === "reposicion" && nextRepo && (
              <p className="text-[11px] text-green-400 mt-1">
                Proxima reposicion estimada: ~{formatDateShort(nextRepo)}
              </p>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
