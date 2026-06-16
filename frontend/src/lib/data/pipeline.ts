import { createClient } from "@/lib/supabase/server";
import { withCachedData } from "@/lib/cache";
import type { PipelineCard } from "@/lib/pipeline/types";

export const getPipelineCards = withCachedData(
  "pipeline:cards",
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

    const cardIds = (rawCards ?? []).map((c) => c.id);

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

    // 3. Agrupar por card_id
    const followupsByCard = new Map<string, typeof followupsRes.data>();
    for (const f of followupsRes.data ?? []) {
      const list = followupsByCard.get(f.card_id) ?? [];
      list.push(f);
      followupsByCard.set(f.card_id, list);
    }

    const latestNoteByCard = new Map<
      string,
      NonNullable<typeof notesRes.data>[number]
    >();
    for (const n of notesRes.data ?? []) {
      if (!latestNoteByCard.has(n.card_id)) {
        latestNoteByCard.set(n.card_id, n);
      }
    }

    // 4. Ensamblar cards
    return (rawCards ?? []).map((c) => ({
      ...c,
      customer: Array.isArray(c.customer)
        ? (
            c.customer as unknown as {
              name: string;
              phone: string | null;
              email: string | null;
            }[]
          )[0]
        : (c.customer as {
            name: string;
            phone: string | null;
            email: string | null;
          }),
      prediction: Array.isArray(c.prediction)
        ? (
            c.prediction as unknown as PipelineCard["prediction"][]
          )[0] ?? null
        : (c.prediction as PipelineCard["prediction"]),
      followups: (followupsByCard.get(c.id) ?? []) as PipelineCard["followups"],
      latest_note: (latestNoteByCard.get(c.id) ?? null) as PipelineCard["latest_note"],
    }));
  },
  { revalidate: 60, tags: ["pipeline"] }
);
