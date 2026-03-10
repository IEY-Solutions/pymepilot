"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Phone, Mail, Clock, X, Sparkles } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import type { PipelineCard as PipelineCardType } from "@/lib/pipeline/types";
import { VERTICAL_STYLES } from "@/lib/pipeline/types";

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Urgente", color: "bg-red-100 text-red-700" },
  2: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  3: { label: "Media", color: "bg-yellow-100 text-yellow-700" },
  4: { label: "Normal", color: "bg-blue-100 text-blue-700" },
  5: { label: "Baja", color: "bg-gray-100 text-gray-600" },
};

function timeInColumn(updatedAt: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Hoy";
  if (diff === 1) return "1 dia";
  return `${diff} dias`;
}

function getActiveFollowup(card: PipelineCardType) {
  const pending = card.followups
    .filter((f) => f.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.scheduled_date).getTime() -
        new Date(b.scheduled_date).getTime()
    );
  return pending[0] ?? null;
}

/** Label del badge para "en_seguimiento" (followup activo) */
function followupLabel(card: PipelineCardType) {
  const active = getActiveFollowup(card);
  if (!active) return null;

  const total = card.followups.length;
  const completed = card.followups.filter((f) => f.status === "completed").length;
  const current = completed + 1;

  const today = new Date().toISOString().split("T")[0];
  const scheduled = active.scheduled_date;

  const diffDays = Math.ceil(
    (new Date(scheduled).getTime() - new Date(today).getTime()) / 86_400_000
  );

  let timing: string;
  let badgeColor: string;
  if (diffDays <= 0) {
    timing = "Hoy";
    badgeColor = "bg-orange-100 text-orange-700";
  } else if (diffDays === 1) {
    timing = "Manana";
    badgeColor = "bg-yellow-100 text-yellow-700";
  } else {
    timing = `en ${diffDays} dias`;
    badgeColor = "bg-gray-100 text-gray-600";
  }

  // Agregar origen si es distinto de "contactado"
  const originLabel = active.origin_stage && active.origin_stage !== "contactado"
    ? ` (post-${active.origin_stage === "por_cotizar" ? "cotiz." : "envio"})`
    : "";

  return { text: `Seguimiento ${current}/${total} — ${timing}${originLabel}`, color: badgeColor };
}

/** Badge de espera para etapas con timer (contactado, por_cotizar, cotizacion_enviada) */
function deadlineBadge(card: PipelineCardType): { text: string; color: string } | null {
  if (!card.stage_deadline) return null;

  const today = new Date().toISOString().split("T")[0];
  const diffDays = Math.ceil(
    (new Date(card.stage_deadline).getTime() - new Date(today).getTime()) / 86_400_000
  );

  const stageLabels: Record<string, string> = {
    contactado: "respuesta",
    por_cotizar: "cotizacion",
    cotizacion_enviada: "cierre",
  };
  const label = stageLabels[card.column_name] ?? "respuesta";

  if (diffDays < 0) {
    return { text: `Sin ${label} — vencido hace ${Math.abs(diffDays)}d`, color: "bg-red-100 text-red-700" };
  } else if (diffDays === 0) {
    return { text: `Esperando ${label} — vence hoy`, color: "bg-orange-100 text-orange-700" };
  } else if (diffDays === 1) {
    return { text: `Esperando ${label} — vence manana`, color: "bg-yellow-100 text-yellow-700" };
  } else {
    return { text: `Esperando ${label} — ${diffDays}d restantes`, color: "bg-gray-100 text-gray-600" };
  }
}

interface Props {
  card: PipelineCardType;
  isGenerating?: boolean;
  onClick: () => void;
  onDiscard?: () => void;
}

export function PipelineCard({ card, isGenerating, onClick, onDiscard }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : undefined,
      }
    : undefined;

  const priority = priorityLabels[card.priority] ?? priorityLabels[3];
  const verticalStyle = VERTICAL_STYLES[card.vertical] ?? {
    label: card.vertical,
    color: "bg-purple-100 text-purple-700",
  };
  const followup = followupLabel(card);
  const deadline = deadlineBadge(card);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border p-3 space-y-2 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow touch-none ${
        card.is_expired ? "opacity-60 border-gray-300" : "border-gray-200"
      } ${isDragging ? "shadow-lg" : ""}`}
      {...listeners}
      {...attributes}
      onClick={onClick}
    >
      {/* Header: nombre + descartar */}
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-gray-900 truncate">
            {card.customer.name}
          </h4>
        </div>
        {card.is_expired && onDiscard && (
          <button
            className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
            title="Descartar"
            aria-label="Descartar card"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Badges: vertical + prioridad */}
      <div className="flex flex-wrap gap-1">
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${verticalStyle.color}`}
        >
          {verticalStyle.label}
        </span>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priority.color}`}
        >
          {priority.label}
        </span>
        {card.is_expired && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">
            Vencida
            <InfoTooltip text={TOOLTIPS["pipeline.vencida"]} />
          </span>
        )}
      </div>

      {/* Followup badge (en "en_seguimiento") */}
      {card.column_name === "en_seguimiento" && followup && (
        <div
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${followup.color}`}
        >
          {followup.text}
        </div>
      )}

      {/* Deadline badge (contactado, por_cotizar, cotizacion_enviada) */}
      {card.column_name !== "en_seguimiento" && deadline && (
        <div
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${deadline.color}`}
        >
          {deadline.text}
        </div>
      )}

      {/* Contacto rapido */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {card.customer.phone && (
          <a
            href={`tel:${card.customer.phone}`}
            className="flex items-center gap-0.5 hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Phone className="h-3 w-3" />
          </a>
        )}
        {card.customer.email && (
          <a
            href={`mailto:${card.customer.email}`}
            className="flex items-center gap-0.5 hover:text-blue-600"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Mail className="h-3 w-3" />
          </a>
        )}
        <span className="flex items-center gap-0.5 ml-auto">
          <Clock className="h-3 w-3" />
          {timeInColumn(card.updated_at)}
        </span>
      </div>

      {/* Ultima nota (truncada) */}
      {card.latest_note?.note_text && !isGenerating && (
        <p className="text-[10px] text-gray-500 truncate italic">
          {card.latest_note.note_text}
        </p>
      )}

      {/* Indicador de generacion de propuesta */}
      {isGenerating && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-600 animate-pulse">
          <Sparkles className="h-3 w-3" />
          <span>Actualizando propuesta...</span>
        </div>
      )}
    </div>
  );
}
