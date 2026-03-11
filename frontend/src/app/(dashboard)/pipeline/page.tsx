import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import type { PipelineCard } from "@/lib/pipeline/types";

export default async function PipelinePage() {
  const supabase = await createClient();

  // NOTA: Las mutaciones (sync RPC + expiracion + auto-move) se ejecutan
  // SOLO en GET /api/pipeline (route.ts), NO aqui. Un Server Component
  // se renderiza en cada navegacion y prefetch — no debe tener side effects.
  // El client component (PipelineBoard) llama refreshBoard() al montar,
  // que dispara el GET y ejecuta las mutaciones una sola vez.

  // 1. Fetch cards con relaciones (read-only)
  const { data: rawCards, error } = await supabase
    .from("pipeline_cards")
    .select(
      `id, tenant_id, prediction_id, customer_id, column_name, vertical,
       priority, is_expired, stage_messages, stage_deadline, created_at, updated_at,
       customer:customers!inner(name, phone, email),
       prediction:predictions(message_text, confidence_score, next_reposition_estimate)`
    )
    .order("is_expired", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-4">Pipeline</h1>
        <p className="text-red-400 bg-red-500/15 p-4 rounded-lg">
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
          .select("id, card_id, sequence_number, scheduled_date, status, completed_at, origin_stage")
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
      ? (c.prediction as unknown as { message_text: string | null; confidence_score: number | null; next_reposition_estimate: string | null }[])[0] ?? null
      : c.prediction as { message_text: string | null; confidence_score: number | null; next_reposition_estimate: string | null } | null,
    followups: (followupsByCard.get(c.id) ?? []) as PipelineCard["followups"],
    latest_note: (latestNoteByCard.get(c.id) ?? null) as PipelineCard["latest_note"],
  }));

  return <PipelineBoard initialCards={cards} />;
}
