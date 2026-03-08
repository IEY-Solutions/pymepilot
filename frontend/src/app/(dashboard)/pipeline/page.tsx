import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PipelineCard } from "@/lib/pipeline/types";

export default async function PipelinePage() {
  const supabase = await createClient();

  // 1. Sync: crear cards para predicciones nuevas
  await supabase.rpc("sync_predictions_to_pipeline");

  // 2. Marcar vencidas: cards en "a_contactar" con mas de 3 dias
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await supabase
    .from("pipeline_cards")
    .update({ is_expired: true })
    .eq("column_name", "a_contactar")
    .eq("is_expired", false)
    .lt("created_at", threeDaysAgo);

  // 3. Fetch cards con relaciones
  const { data: rawCards, error } = await supabase
    .from("pipeline_cards")
    .select(
      `id, tenant_id, prediction_id, customer_id, column_name, vertical,
       priority, is_expired, stage_messages, created_at, updated_at,
       customer:customers!inner(name, phone, email),
       prediction:predictions(message_text, confidence_score)`
    )
    .order("is_expired", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Pipeline</h1>
        <p className="text-red-600 bg-red-50 p-4 rounded-lg">
          Error al cargar el pipeline. Intenta recargar la pagina.
        </p>
      </div>
    );
  }

  const cardIds = (rawCards ?? []).map((c) => c.id);

  // 4. Fetch followups y notas en paralelo
  const [followupsRes, notesRes] = cardIds.length > 0
    ? await Promise.all([
        supabase
          .from("followups")
          .select("id, card_id, sequence_number, scheduled_date, status, completed_at")
          .in("card_id", cardIds)
          .order("sequence_number", { ascending: true }),
        supabase
          .from("contact_notes")
          .select("id, card_id, result, note_text, followup_id, created_at")
          .in("card_id", cardIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  // 5. Agrupar por card_id
  const followupsByCard = new Map<string, typeof followupsRes.data>();
  for (const f of followupsRes.data ?? []) {
    const list = followupsByCard.get(f.card_id) ?? [];
    list.push(f);
    followupsByCard.set(f.card_id, list);
  }

  const latestNoteByCard = new Map<string, NonNullable<typeof notesRes.data>[number]>();
  for (const n of notesRes.data ?? []) {
    if (!latestNoteByCard.has(n.card_id)) {
      latestNoteByCard.set(n.card_id, n);
    }
  }

  // 6. Ensamblar cards
  const cards: PipelineCard[] = (rawCards ?? []).map((c) => ({
    ...c,
    customer: Array.isArray(c.customer)
      ? (c.customer as unknown as { name: string; phone: string | null; email: string | null }[])[0]
      : c.customer as { name: string; phone: string | null; email: string | null },
    prediction: Array.isArray(c.prediction)
      ? (c.prediction as unknown as { message_text: string | null; confidence_score: number | null }[])[0] ?? null
      : c.prediction as { message_text: string | null; confidence_score: number | null } | null,
    followups: (followupsByCard.get(c.id) ?? []) as PipelineCard["followups"],
    latest_note: (latestNoteByCard.get(c.id) ?? null) as PipelineCard["latest_note"],
  }));

  return <PipelineBoard initialCards={cards} />;
}
