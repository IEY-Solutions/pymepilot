"use client";

import { useState } from "react";
import {
  X, Phone, PhoneOff, FileText, MessageCircle, Send,
  CheckCircle2, XCircle, StickyNote, Mail, Copy, Check,
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
import { VERTICAL_STYLES, COLUMN_LABELS } from "@/lib/pipeline/types";

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
  { value: "contesto", label: "Contesto", icon: Phone, color: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" },
  { value: "no_contesto", label: "No contesto", icon: PhoneOff, color: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200" },
  { value: "pidio_cotizacion", label: "Pidio cotizacion", icon: FileText, color: "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200" },
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
              event.type === "created" ? "bg-gray-300" : "bg-blue-500"
            }`} />
            {i < events.length - 1 && (
              <div className="w-px flex-1 bg-gray-200 mt-1" />
            )}
          </div>
          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-700">{event.label}</span>
              <span className="text-[10px] text-gray-400">{formatRelativeDate(event.date)}</span>
              {event.type === "note" && event.id && (
                <button
                  onClick={() => onDeleteNote(event.id!)}
                  className="opacity-0 group-hover/event:opacity-100 text-gray-300 hover:text-red-500 transition-all ml-auto"
                  title="Borrar nota"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {event.note && (
              <p className="text-xs text-gray-500 mt-0.5 italic">{event.note}</p>
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
  const message = stageMessage ?? card.prediction?.message_text ?? null;
  const isStageMessage = !!stageMessage;

  if (!message) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  return (
    <div className="mx-4 mt-3 bg-gray-50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            {isStageMessage ? "Mensaje sugerido para esta etapa" : "Mensaje original"}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
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
      </div>
      <p className="text-xs text-gray-600 whitespace-pre-line">{message}</p>
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
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Resultado del contacto</p>
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
                  ? `${opt.color} border-2 ring-1 ring-offset-1 ring-current`
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
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

function NoteOnlyActions({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (note: string) => void;
  isSubmitting: boolean;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Agregar nota</p>
      <NoteField value={note} onChange={setNote} placeholder="Ej: quedo en confirmar la semana que viene" />
      <SubmitButton
        disabled={!note.trim() || isSubmitting}
        isSubmitting={isSubmitting}
        label="Guardar nota"
        onClick={() => onSubmit(note)}
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
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide">Siguiente paso</p>
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
                  ? `${opt.color} border-2 ring-1 ring-offset-1 ring-current`
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
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
      className="w-full border border-gray-300 rounded-lg p-2.5 text-sm resize-none h-16 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
      className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isSubmitting ? "Guardando..." : label}
    </button>
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{card.customer.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${verticalStyle?.color ?? "bg-gray-100 text-gray-700"}`}>
                  {verticalStyle?.label ?? card.vertical}
                </span>
                <span className="text-[10px] text-gray-500">
                  Prioridad {priorityLabel}
                </span>
                <span className="text-[10px] text-gray-400">
                  {columnLabel}
                  <InfoTooltip text={TOOLTIPS[`pipeline.${card.column_name}` as keyof typeof TOOLTIPS] ?? ""} />
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Contacto */}
          <div className="flex gap-3 mt-2">
            {card.customer.phone && (
              <a href={`tel:${card.customer.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                <Phone className="h-3 w-3" /> {card.customer.phone}
              </a>
            )}
            {card.customer.email && (
              <a href={`mailto:${card.customer.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                <Mail className="h-3 w-3" /> {card.customer.email}
              </a>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mensaje sugerido — stage_messages[etapa] o prediction.message_text */}
          <SuggestedMessage card={card} />

          {/* Timeline de actividad */}
          {allNotes.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">Actividad</p>
              <Timeline notes={allNotes} card={card} onDeleteNote={onDeleteNote} />
            </div>
          )}
        </div>

        {/* Acciones (fijas abajo) */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0">
          {renderActions(card, activeFollowup, isSubmitting, withLoading, onContactSubmit, onFollowupSubmit, onAddNote, onAdvance)}
        </div>
      </div>
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
  switch (card.column_name) {
    case "a_contactar":
      return (
        <ContactActions
          isSubmitting={isSubmitting}
          onSubmit={(result, note) => withLoading(() => onContactSubmit(result, note))}
        />
      );

    case "contactado":
      return (
        <NoteOnlyActions
          isSubmitting={isSubmitting}
          onSubmit={(note) => withLoading(() => onAddNote(note))}
        />
      );

    case "en_seguimiento":
      return (
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
      );

    case "por_cotizar":
      return (
        <AdvanceActions
          isSubmitting={isSubmitting}
          options={[
            { label: "Cotizacion enviada", column: "cotizacion_enviada", icon: Send, color: "bg-indigo-100 text-indigo-700 border-indigo-300 hover:bg-indigo-200" },
            { label: "No avanza", column: "por_cotizar", icon: StickyNote, color: "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200" },
          ]}
          onSubmit={(toColumn, note) => {
            if (toColumn === "por_cotizar") {
              withLoading(() => onAddNote(note));
            } else {
              withLoading(() => onAdvance(toColumn, note));
            }
          }}
        />
      );

    case "cotizacion_enviada":
      return (
        <AdvanceActions
          isSubmitting={isSubmitting}
          options={[
            { label: "Vendido", column: "vendido", icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-300 hover:bg-green-200" },
            { label: "Rechazada", column: "cotizacion_enviada", icon: XCircle, color: "bg-red-100 text-red-700 border-red-300 hover:bg-red-200" },
          ]}
          onSubmit={(toColumn, note) => {
            if (toColumn === "cotizacion_enviada") {
              withLoading(() => onAddNote(note));
            } else {
              withLoading(() => onAdvance(toColumn, note));
            }
          }}
        />
      );

    case "vendido":
      return (
        <p className="text-xs text-gray-500 text-center py-2">
          Venta cerrada. Sin acciones pendientes.
        </p>
      );

    default:
      return null;
  }
}
