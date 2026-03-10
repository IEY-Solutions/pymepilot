"use client";

import { useDroppable } from "@dnd-kit/core";
import { PipelineCard } from "./pipeline-card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";
import type { PipelineCard as PipelineCardType, ColumnName } from "@/lib/pipeline/types";
import { COLUMN_LABELS, COLUMN_COLORS } from "@/lib/pipeline/types";

interface Props {
  column: ColumnName;
  cards: PipelineCardType[];
  generatingCardIds: Set<string>;
  onCardClick: (card: PipelineCardType) => void;
  onCardDiscard: (card: PipelineCardType) => void;
}

export function PipelineColumn({ column, cards, generatingCardIds, onCardClick, onCardDiscard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  const label = COLUMN_LABELS[column];
  const headerColor = COLUMN_COLORS[column];
  const tooltipKey = `pipeline.${column}` as keyof typeof TOOLTIPS;

  return (
    <div className="flex flex-col min-w-[200px] flex-1">
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${headerColor}`}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </h3>
        <span className="text-xs font-medium opacity-70">{cards.length}</span>
        {TOOLTIPS[tooltipKey] && <InfoTooltip text={TOOLTIPS[tooltipKey]} />}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 rounded-b-lg transition-colors min-h-[200px] ${
          isOver
            ? "bg-blue-50 border-2 border-dashed border-blue-300"
            : "bg-gray-50 border border-gray-200"
        }`}
      >
        {cards.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">
            {isOver ? "Soltar aca" : "Sin cards"}
          </p>
        )}
        {cards.map((card) => (
          <PipelineCard
            key={card.id}
            card={card}
            isGenerating={generatingCardIds.has(card.id)}
            onClick={() => onCardClick(card)}
            onDiscard={() => onCardDiscard(card)}
          />
        ))}
      </div>
    </div>
  );
}
