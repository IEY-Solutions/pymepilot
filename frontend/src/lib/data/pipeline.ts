import { cache as reactCache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Followup, ContactNote, PipelineCard } from "@/lib/pipeline/types";

type PipelineCardRow = Omit<
  PipelineCard,
  "customer" | "prediction" | "followups" | "latest_note"
> & {
  customer:
    | PipelineCard["customer"]
    | PipelineCard["customer"][];
  prediction:
    | NonNullable<PipelineCard["prediction"]>
    | NonNullable<PipelineCard["prediction"]>[];
};

const buildPipelineCards = async (
  rawCards: PipelineCardRow[],
  followups: Followup[],
  notes: ContactNote[]
): Promise<PipelineCard[]> => {
  const followupsByCard = new Map<string, Followup[]>();
  for (const followup of followups) {
    const list = followupsByCard.get(followup.card_id) ?? [];
    list.push(followup);
    followupsByCard.set(followup.card_id, list);
  }

  const latestNoteByCard = new Map<string, ContactNote>();
  for (const note of notes) {
    if (!latestNoteByCard.has(note.card_id)) {
      latestNoteByCard.set(note.card_id, note);
    }
  }

  return rawCards.map((card) => ({
    ...card,
    customer: Array.isArray(card.customer) ? card.customer[0] : card.customer,
    prediction: Array.isArray(card.prediction)
      ? card.prediction[0] ?? null
      : card.prediction,
    followups: followupsByCard.get(card.id) ?? [],
    latest_note: latestNoteByCard.get(card.id) ?? null,
  }));
};

export const getPipelineCards = reactCache(
  async (_tenantId: string): Promise<PipelineCard[]> => {
    const supabase = await createClient();

    // 1. Fetch cards con relaciones (read-only)
    const { data: rawCards, error } = await supabase
      .from("pipeline_cards")
      .select(
        `id, tenant_id, prediction_id, customer_id, column_name, vertical,
         priority, is_expired, stage_messages, stage_deadline, created_at, updated_at,
         customer:customers!inner(name, phone, email),
         prediction:predictions(message_text, confidence_score, next_reposition_estimate, metadata)`
      )
      .order("is_expired", { ascending: true })
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Pipeline fetch failed: ${error.message}`);
    }

    const cardIds = (rawCards ?? []).map((card) => card.id);

    // 2. Fetch followups y notas en paralelo
    const [followupsRes, notesRes] =
      cardIds.length > 0
        ? await Promise.all([
            supabase
              .from("followups")
              .select(
                "id, card_id, sequence_number, scheduled_date, status, completed_at, origin_stage"
              )
              .in("card_id", cardIds)
              .order("sequence_number", { ascending: true }),
            supabase
              .from("contact_notes")
              .select("id, card_id, result, note_text, followup_id, created_at")
              .in("card_id", cardIds)
              .order("created_at", { ascending: false }),
          ])
        : [{ data: [] }, { data: [] }];

    return buildPipelineCards(
      (rawCards ?? []) as PipelineCardRow[],
      (followupsRes.data ?? []) as Followup[],
      (notesRes.data ?? []) as ContactNote[]
    );
  }
);
