"use client";

import { useState, useMemo, useCallback } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { PipelineColumn } from "./pipeline-column";
import { PipelineCard as PipelineCardComponent } from "./pipeline-card";
import { ContactModal } from "./contact-modal";
import { RefreshCw } from "lucide-react";
import {
  COLUMN_ORDER,
  type PipelineCard,
  type ColumnName,
  type ContactResult,
  type ContactNote,
  type Followup,
} from "@/lib/pipeline/types";

interface Props {
  initialCards: PipelineCard[];
}

export function PipelineBoard({ initialCards }: Props) {
  const [cards, setCards] = useState<PipelineCard[]>(initialCards);
  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const [modalFollowup, setModalFollowup] = useState<Followup | null>(null);
  const [modalNotes, setModalNotes] = useState<ContactNote[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [generatingCardIds, setGeneratingCardIds] = useState<Set<string>>(new Set());

  // Mantener modalCard sincronizada con cards state
  // Cuando refreshBoard() actualiza cards, el modal abierto se actualiza también
  const [modalCardId, setModalCardId] = useState<string | null>(null);
  const modalCard = useMemo(
    () => (modalCardId ? cards.find((c) => c.id === modalCardId) ?? null : null),
    [cards, modalCardId]
  );

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // Agrupar cards por columna
  const cardsByColumn = useMemo(() => {
    const grouped: Record<ColumnName, PipelineCard[]> = {
      a_contactar: [],
      contactado: [],
      en_seguimiento: [],
      por_cotizar: [],
      cotizacion_enviada: [],
      vendido: [],
    };
    for (const card of cards) {
      const col = card.column_name as ColumnName;
      if (grouped[col]) {
        grouped[col].push(card);
      }
    }
    return grouped;
  }, [cards]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = cards.find((c) => c.id === event.active.id);
      setActiveCard(card ?? null);
    },
    [cards]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;

      const cardId = active.id as string;
      const toColumn = over.id as ColumnName;

      const card = cards.find((c) => c.id === cardId);
      if (!card || card.column_name === toColumn) return;

      // Mover optimisticamente y marcar como "generando"
      setCards((prev) =>
        prev.map((c) =>
          c.id === cardId ? { ...c, column_name: toColumn } : c
        )
      );
      setGeneratingCardIds((prev) => new Set(prev).add(cardId));

      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move", card_id: cardId, to_column: toColumn }),
        });
        if (!res.ok) {
          setCards((prev) =>
            prev.map((c) =>
              c.id === cardId ? { ...c, column_name: card.column_name } : c
            )
          );
        } else {
          // Refrescar para traer stage_messages generado por Claude
          await refreshBoard();
        }
      } catch {
        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, column_name: card.column_name } : c
          )
        );
      } finally {
        setGeneratingCardIds((prev) => {
          const next = new Set(prev);
          next.delete(cardId);
          return next;
        });
      }
    },
    [cards]
  );

  // Abrir modal: funciona en TODAS las etapas
  const openModal = useCallback(async (card: PipelineCard) => {
    // Buscar followup activo si es "en_seguimiento"
    let followup: Followup | null = null;
    if (card.column_name === "en_seguimiento") {
      const pending = card.followups
        .filter((f) => f.status === "pending")
        .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
      followup = pending[0] ?? null;
    }

    // Fetch todas las notas de esta card para el timeline
    let notes: ContactNote[] = [];
    try {
      const res = await fetch(`/api/pipeline/notes?card_id=${card.id}`);
      if (res.ok) {
        const data = await res.json();
        notes = data.notes ?? [];
      }
    } catch {
      // Si falla el fetch de notas, mostrar el modal sin timeline
    }

    setModalCardId(card.id);
    setModalFollowup(followup);
    setModalNotes(notes);
  }, []);

  const handleCardClick = useCallback(
    (card: PipelineCard) => {
      openModal(card);
    },
    [openModal]
  );

  const closeModal = useCallback(() => {
    setModalCardId(null);
    setModalFollowup(null);
    setModalNotes([]);
  }, []);

  // Refresh completo del board
  const refreshBoard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/pipeline");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards ?? []);
      }
    } catch (err) {
      console.error("Error refreshing pipeline:", err);
    }
    setIsRefreshing(false);
  }, []);

  // Accion genérica: llama API, refresca board, cierra modal
  const apiAction = useCallback(
    async (payload: Record<string, unknown>) => {
      const cardId = payload.card_id as string | undefined;
      if (cardId) {
        setGeneratingCardIds((prev) => new Set(prev).add(cardId));
      }
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await refreshBoard();
        }
      } catch (err) {
        console.error("Error en accion pipeline:", err);
      } finally {
        if (cardId) {
          setGeneratingCardIds((prev) => {
            const next = new Set(prev);
            next.delete(cardId);
            return next;
          });
        }
      }
      closeModal();
    },
    [refreshBoard, closeModal]
  );

  // Callbacks para el modal
  const handleContactSubmit = useCallback(
    async (result: ContactResult, noteText: string) => {
      if (!modalCard) return;
      await apiAction({
        action: "contact",
        card_id: modalCard.id,
        result,
        note_text: noteText || undefined,
      });
    },
    [modalCard, apiAction]
  );

  const handleFollowupSubmit = useCallback(
    async (result: ContactResult, noteText: string) => {
      if (!modalCard || !modalFollowup) return;
      await apiAction({
        action: "complete_followup",
        card_id: modalCard.id,
        followup_id: modalFollowup.id,
        result,
        note_text: noteText || undefined,
      });
    },
    [modalCard, modalFollowup, apiAction]
  );

  const handleAddNote = useCallback(
    async (noteText: string) => {
      if (!modalCard) return;
      await apiAction({
        action: "add_note",
        card_id: modalCard.id,
        note_text: noteText,
      });
    },
    [modalCard, apiAction]
  );

  const handleAdvance = useCallback(
    async (toColumn: ColumnName, noteText: string) => {
      if (!modalCard) return;
      await apiAction({
        action: "advance",
        card_id: modalCard.id,
        to_column: toColumn,
        note_text: noteText || undefined,
      });
    },
    [modalCard, apiAction]
  );

  // Borrar nota del timeline
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      try {
        const res = await fetch("/api/pipeline/notes", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_id: noteId }),
        });
        if (res.ok) {
          // Actualizar las notas del modal sin cerrarlo
          setModalNotes((prev) => prev.filter((n) => n.id !== noteId));
        }
      } catch (err) {
        console.error("Error deleting note:", err);
      }
    },
    []
  );

  // Descartar card vencida
  const handleCardDiscard = useCallback(
    async (card: PipelineCard) => {
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "discard", card_id: card.id }),
        });
        if (!res.ok) {
          setCards((prev) => [...prev, card]);
        }
      } catch {
        setCards((prev) => [...prev, card]);
      }
    },
    []
  );

  const totalCards = cards.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">
            {totalCards} {totalCards === 1 ? "cliente" : "clientes"} en el pipeline
          </p>
        </div>
        <button
          onClick={refreshBoard}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Board Kanban */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6">
          {COLUMN_ORDER.map((column) => (
            <PipelineColumn
              key={column}
              column={column}
              cards={cardsByColumn[column]}
              generatingCardIds={generatingCardIds}
              onCardClick={handleCardClick}
              onCardDiscard={handleCardDiscard}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="w-[200px] opacity-90">
              <PipelineCardComponent card={activeCard} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal adaptativo */}
      {modalCard && (
        <ContactModal
          card={modalCard}
          activeFollowup={modalFollowup}
          allNotes={modalNotes}
          onContactSubmit={handleContactSubmit}
          onFollowupSubmit={handleFollowupSubmit}
          onAddNote={handleAddNote}
          onAdvance={handleAdvance}
          onDeleteNote={handleDeleteNote}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
