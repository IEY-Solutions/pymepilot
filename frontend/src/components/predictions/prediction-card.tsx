import { CopyButton } from "./copy-button";
import { PredictionActions } from "./prediction-actions";
import { Phone, Mail, Calendar, TrendingUp } from "lucide-react";

interface PredictionMetadata {
  sequence_day?: number;
  window_days?: number;
  [key: string]: unknown;
}

interface Prediction {
  id: string;
  vertical: string;
  prediction_date: string;
  contact_date: string | null;
  message_text: string | null;
  confidence_score: number | null;
  priority: number;
  status: "pending" | "contacted" | "ignored";
  metadata?: PredictionMetadata | null;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    last_purchase_date: string | null;
  };
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: "Urgente", color: "bg-red-100 text-red-700" },
  2: { label: "Alta", color: "bg-orange-100 text-orange-700" },
  3: { label: "Media", color: "bg-yellow-100 text-yellow-700" },
  4: { label: "Normal", color: "bg-blue-100 text-blue-700" },
  5: { label: "Baja", color: "bg-gray-100 text-gray-600" },
};

const verticalStyles: Record<
  string,
  { label: string; color: string }
> = {
  reposicion: { label: "Reposicion", color: "bg-blue-100 text-blue-700" },
  activacion: { label: "Activacion", color: "bg-green-100 text-green-700" },
  cross_sell: { label: "Cross-sell", color: "bg-purple-100 text-purple-700" },
  recuperacion: { label: "Recuperacion", color: "bg-amber-100 text-amber-700" },
};

function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "Sin compras";
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return "---";
  const diff = Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `Hace ${diff} dias`;
}

function getVerticalBadgeText(prediction: Prediction): string {
  const style = verticalStyles[prediction.vertical];
  const label = style?.label ?? prediction.vertical;
  const meta = prediction.metadata;

  if (prediction.vertical === "activacion" && meta?.sequence_day) {
    return `${label} - Dia ${meta.sequence_day}`;
  }
  if (prediction.vertical === "recuperacion" && meta?.window_days) {
    return `${label} - ${meta.window_days}d`;
  }
  return label;
}

export function PredictionCard({ prediction }: { prediction: Prediction }) {
  const priority = priorityLabels[prediction.priority] ?? priorityLabels[3];
  const verticalStyle = verticalStyles[prediction.vertical] ?? {
    label: prediction.vertical,
    color: "bg-purple-100 text-purple-700",
  };
  const verticalBadgeText = getVerticalBadgeText(prediction);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header: nombre + badges */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">
            {prediction.customer.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.color}`}
            >
              {priority.label}
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${verticalStyle.color}`}
            >
              {verticalBadgeText}
            </span>
            {prediction.confidence_score !== null && (
              <span className="flex items-center gap-0.5 text-xs text-gray-500">
                <TrendingUp className="h-3 w-3" />
                {Math.round(prediction.confidence_score * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info del cliente */}
      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
        {prediction.customer.phone && (
          <a
            href={`tel:${prediction.customer.phone}`}
            className="flex items-center gap-1 hover:text-blue-600"
          >
            <Phone className="h-3.5 w-3.5" />
            {prediction.customer.phone}
          </a>
        )}
        {prediction.customer.email && (
          <a
            href={`mailto:${prediction.customer.email}`}
            className="flex items-center gap-1 hover:text-blue-600"
          >
            <Mail className="h-3.5 w-3.5" />
            {prediction.customer.email}
          </a>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {daysAgo(prediction.customer.last_purchase_date)}
        </span>
      </div>

      {/* Mensaje sugerido */}
      {prediction.message_text && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {prediction.message_text}
          </p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between pt-1">
        {prediction.message_text && (
          <CopyButton text={prediction.message_text} />
        )}
        <PredictionActions
          predictionId={prediction.id}
          initialStatus={prediction.status}
        />
      </div>
    </div>
  );
}
