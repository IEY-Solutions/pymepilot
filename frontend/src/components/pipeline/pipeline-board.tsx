"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { PipelineColumn } from "./pipeline-column";
import { PipelineCard as PipelineCardComponent } from "./pipeline-card";
import { ContactModal } from "./contact-modal";
import { SaleCelebration } from "./sale-celebration";
import { RefreshCw, Bell, X } from "lucide-react";
import {
  COLUMN_ORDER,
  type PipelineCard,
  type ColumnName,
  type ContactResult,
  type ContactNote,
  type Followup,
  type FollowupNotification,
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
  const [notifications, setNotifications] = useState<FollowupNotification[]>([]);
  const [celebrationName, setCelebrationName] = useState<string | null>(null);

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

  const refreshBoard = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/pipeline");
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards ?? []);
        if (data.notifications?.length > 0) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newNotifs = (data.notifications as FollowupNotification[]).filter((n) => !existingIds.has(n.id));
            return [...prev, ...newNotifs];
          });
        }
      }
    } catch {
      // Error silenciado en client-side (no exponer detalles al usuario)
    }
    setIsRefreshing(false);
  }, []);

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
          // Celebracion si llega a vendido
          if (toColumn === "vendido") {
            setCelebrationName(card.customer.name);
          }
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
    [cards, refreshBoard]
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

  // Sync al montar: ejecuta las mutaciones (sync RPC, expiracion, auto-move)
  // a traves del GET /api/pipeline en vez de hacerlo en el Server Component
  useEffect(() => {
    refreshBoard();
  }, [refreshBoard]);

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
      } catch {
        // Error silenciado en client-side
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
      // Disparar celebracion si avanza a vendido
      if (toColumn === "vendido") {
        setCelebrationName(modalCard.customer.name);
      }
      await apiAction({
        action: "advance",
        card_id: modalCard.id,
        to_column: toColumn,
        note_text: noteText || undefined,
      });
    },
    [modalCard, apiAction]
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
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-sm text-white/50">
            {totalCards} {totalCards === 1 ? "cliente" : "clientes"} en el pipeline
          </p>
        </div>
        <button
          onClick={refreshBoard}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white/70 bg-white/[0.06] border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Notificaciones de followups del dia */}
      {notifications.length > 0 && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-300">
                Seguimientos para hoy ({notifications.length})
              </span>
            </div>
            <button
              onClick={() => setNotifications([])}
              className="p-0.5 text-amber-400/50 hover:text-amber-400 transition-colors"
              aria-label="Cerrar notificaciones"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {notifications.map((n) => (
            <div key={n.id} className="text-xs text-amber-400/80">
              <span className="font-medium">{n.title}</span> — {n.body}
            </div>
          ))}
        </div>
      )}

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
          onClose={closeModal}
        />
      )}

      {/* Celebracion de venta */}
      {celebrationName && (
        <SaleCelebration
          customerName={celebrationName}
          onComplete={() => setCelebrationName(null)}
        />
      )}
    </div>
  );
}
