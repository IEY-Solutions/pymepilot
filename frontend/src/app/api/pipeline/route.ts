import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  FOLLOWUP_SEQUENCES,
  type ColumnName,
  type ContactResult,
  type Vertical,
  type PipelineResponse,
  type PipelineErrorResponse,
} from "@/lib/pipeline/types";

// ============================================================
// GET /api/pipeline — Obtener todas las cards del pipeline
// POST /api/pipeline — Acciones: sync, move, contact, complete_followup, discard
// ============================================================

// Costo por token de Claude Sonnet (para registro en chat_usage)
const COST_PER_INPUT_TOKEN = 0.000003;
const COST_PER_OUTPUT_TOKEN = 0.000015;

// ------------------------------------------------------------
// GET: Fetch completo del board
// ------------------------------------------------------------
export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "No autenticado" } satisfies PipelineErrorResponse,
      { status: 401 }
    );
  }

  // 1. Sync: crear cards para predicciones nuevas (via RPC)
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
  const { data: cards, error } = await supabase
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
    console.error("Error fetching pipeline cards:", error);
    return Response.json(
      { error: "Error al cargar el pipeline" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 4. Fetch followups y latest notes para todas las cards
  const cardIds = (cards ?? []).map((c) => c.id);

  if (cardIds.length === 0) {
    return Response.json({ cards: [] });
  }

  const [followupsRes, notesRes] = await Promise.all([
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
  ]);

  // 5. Agrupar followups y latest note por card_id
  const followupsByCard = new Map<string, typeof followupsRes.data>();
  for (const f of followupsRes.data ?? []) {
    const list = followupsByCard.get(f.card_id) ?? [];
    list.push(f);
    followupsByCard.set(f.card_id, list);
  }

  const latestNoteByCard = new Map<string, (typeof notesRes.data extends (infer T)[] | null ? T : never)>();
  for (const n of notesRes.data ?? []) {
    if (!latestNoteByCard.has(n.card_id)) {
      latestNoteByCard.set(n.card_id, n);
    }
  }

  // 6. Ensamblar respuesta
  const enrichedCards = (cards ?? []).map((c) => ({
    ...c,
    // Normalizar customer (Supabase !inner puede devolver array)
    customer: Array.isArray(c.customer)
      ? (c.customer as unknown as { name: string; phone: string | null; email: string | null }[])[0]
      : c.customer,
    // Normalizar prediction (puede ser array o null)
    prediction: Array.isArray(c.prediction)
      ? (c.prediction as unknown as { message_text: string | null; confidence_score: number | null }[])[0] ?? null
      : c.prediction,
    followups: followupsByCard.get(c.id) ?? [],
    latest_note: latestNoteByCard.get(c.id) ?? null,
  }));

  // Debug temporal: ver si stage_messages llega al response
  const cardsWithMessages = enrichedCards.filter((c) => {
    const sm = c.stage_messages as Record<string, string> | null;
    return sm && Object.keys(sm).length > 0;
  });
  if (cardsWithMessages.length > 0) {
    console.log(`[pipeline-GET] ${cardsWithMessages.length} cards con stage_messages:`,
      cardsWithMessages.map((c) => ({ id: c.id, col: c.column_name, keys: Object.keys(c.stage_messages as Record<string, string>) })));
  }

  return Response.json({ cards: enrichedCards });
}

// ------------------------------------------------------------
// POST: Acciones del pipeline
// ------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "No autenticado" } satisfies PipelineErrorResponse,
      { status: 401 }
    );
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return Response.json(
      { error: "tenant_id no encontrado" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "JSON invalido" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  const action = body.action as string;

  switch (action) {
    case "sync":
      return handleSync(supabase);
    case "move":
      return handleMove(supabase, tenantId, body);
    case "contact":
      return handleContact(supabase, tenantId, body);
    case "complete_followup":
      return handleCompleteFollowup(supabase, tenantId, body);
    case "discard":
      return handleDiscard(supabase, body);
    case "add_note":
      return handleAddNote(supabase, tenantId, body);
    case "advance":
      return handleAdvance(supabase, tenantId, body);
    default:
      return Response.json(
        { error: `Accion desconocida: ${action}` } satisfies PipelineErrorResponse,
        { status: 400 }
      );
  }
}

// ============================================================
// Handlers
// ============================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Sync predictions → pipeline_cards (via SQL function) */
async function handleSync(supabase: SupabaseClient): Promise<Response> {
  const { data, error } = await supabase.rpc("sync_predictions_to_pipeline");

  if (error) {
    console.error("Error syncing pipeline:", error);
    return Response.json(
      { error: "Error al sincronizar predicciones" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    cards_synced: data ?? 0,
    message: `${data ?? 0} predicciones sincronizadas`,
  } satisfies PipelineResponse);
}

/** Mover card a otra columna (drag & drop) — crea followups si va a en_seguimiento, genera copy dinámico */
async function handleMove(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;
  const toColumn = body.to_column as ColumnName;

  if (!cardId || !toColumn) {
    return Response.json(
      { error: "card_id y to_column son requeridos" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  const validColumns = [
    "a_contactar", "contactado", "en_seguimiento",
    "por_cotizar", "cotizacion_enviada", "vendido",
  ];
  if (!validColumns.includes(toColumn)) {
    return Response.json(
      { error: `Columna invalida: ${toColumn}` } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // 1. Mover la card
  const { error } = await supabase
    .from("pipeline_cards")
    .update({ column_name: toColumn })
    .eq("id", cardId);

  if (error) {
    console.error("Error moving card:", error);
    return Response.json(
      { error: "Error al mover la card" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 2. Si va a "en_seguimiento", crear followups automáticos (secuencia default)
  if (toColumn === "en_seguimiento") {
    // Verificar que no tenga followups pendientes ya
    const { data: existingFollowups } = await supabase
      .from("followups")
      .select("id")
      .eq("card_id", cardId)
      .eq("status", "pending")
      .limit(1);

    if (!existingFollowups || existingFollowups.length === 0) {
      const { data: card } = await supabase
        .from("pipeline_cards")
        .select("vertical")
        .eq("id", cardId)
        .single();

      if (card) {
        const vertical = card.vertical as Vertical;
        const sequence = [...(FOLLOWUP_SEQUENCES[vertical] ?? [2, 5, 10])];
        const followups = sequence.map((days, index) => {
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + days);
          return {
            tenant_id: tenantId,
            card_id: cardId,
            sequence_number: index + 1,
            scheduled_date: scheduledDate.toISOString().split("T")[0],
            status: "pending" as const,
          };
        });

        await supabase.from("followups").insert(followups);
      }
    }
  }

  // 3. Si llega a "vendido", marcar prediction como completed
  if (toColumn === "vendido") {
    const { data: card } = await supabase
      .from("pipeline_cards")
      .select("prediction_id")
      .eq("id", cardId)
      .single();

    if (card?.prediction_id) {
      await supabase
        .from("predictions")
        .update({ status: "completed" })
        .eq("id", card.prediction_id);
    }

    // Marcar followups pendientes como skipped
    await supabase
      .from("followups")
      .update({ status: "skipped" })
      .eq("card_id", cardId)
      .eq("status", "pending");
  }

  // 4. Generar copy dinámico para la etapa destino
  await generateStageCopyForCard(supabase, tenantId, cardId, toColumn);

  return Response.json({ success: true } satisfies PipelineResponse);
}

/** Registrar contacto: crear nota + generar followups (con Claude si hay nota) + mover card */
async function handleContact(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;
  const result = body.result as ContactResult;
  const noteText = (body.note_text as string) || null;

  if (!cardId || !result) {
    return Response.json(
      { error: "card_id y result son requeridos" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  const validResults = ["contesto", "no_contesto", "pidio_cotizacion"];
  if (!validResults.includes(result)) {
    return Response.json(
      { error: `Resultado invalido: ${result}` } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // 1. Obtener la card con datos del cliente y mensaje original
  const { data: card, error: cardError } = await supabase
    .from("pipeline_cards")
    .select("id, vertical, prediction_id, customer:customers!inner(name), prediction:predictions(message_text)")
    .eq("id", cardId)
    .single();

  if (cardError || !card) {
    return Response.json(
      { error: "Card no encontrada" } satisfies PipelineErrorResponse,
      { status: 404 }
    );
  }

  // 2. Registrar la nota de contacto
  const { error: noteError } = await supabase.from("contact_notes").insert({
    tenant_id: tenantId,
    card_id: cardId,
    result,
    note_text: noteText,
  });

  if (noteError) {
    console.error("Error creating contact note:", noteError);
    return Response.json(
      { error: "Error al registrar el contacto" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 3. Determinar a donde mover la card
  let targetColumn: ColumnName;

  if (result === "pidio_cotizacion") {
    // Salto directo a "por_cotizar"
    targetColumn = "por_cotizar";
  } else {
    // Generar seguimientos y mover a "en_seguimiento"
    targetColumn = "en_seguimiento";

    const vertical = card.vertical as Vertical;
    const defaultSequence: number[] = [...(FOLLOWUP_SEQUENCES[vertical] ?? [2, 5, 10])];

    // Si hay nota, intentar que Claude ajuste los plazos
    let sequence: number[] = defaultSequence;
    let claudeTargetColumn: ColumnName | null = null;

    if (noteText && noteText.trim().length > 0) {
      const customerName = Array.isArray(card.customer)
        ? (card.customer as unknown as { name: string }[])[0]?.name
        : (card.customer as { name: string })?.name;

      const claudeResult = await adjustFollowupsWithClaude(
        supabase,
        tenantId,
        noteText,
        vertical,
        customerName ?? "Cliente",
        result,
        defaultSequence
      );

      if (claudeResult) {
        if (claudeResult.target_column) {
          // Claude dice saltar a otra columna directamente
          claudeTargetColumn = claudeResult.target_column;
        }
        if (claudeResult.days && claudeResult.days.length > 0) {
          sequence = claudeResult.days;
        }
      }
    }

    // Si Claude dice saltar a otra columna, respetar eso
    if (claudeTargetColumn) {
      targetColumn = claudeTargetColumn;
    } else {
      // Crear followups con la secuencia (ajustada por Claude o default)
      const followups = sequence.map((days, index) => {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + days);
        return {
          tenant_id: tenantId,
          card_id: cardId,
          sequence_number: index + 1,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          status: "pending" as const,
        };
      });

      const { error: followupError } = await supabase
        .from("followups")
        .insert(followups);

      if (followupError) {
        console.error("Error creating followups:", followupError);
      }
    }
  }

  // 4. Mover la card a la columna destino
  const { error: moveError } = await supabase
    .from("pipeline_cards")
    .update({ column_name: targetColumn })
    .eq("id", cardId);

  if (moveError) {
    console.error("Error moving card after contact:", moveError);
  }

  // 5. Actualizar prediction status a "contacted" si corresponde
  if (card.prediction_id) {
    await supabase
      .from("predictions")
      .update({ status: "contacted", contacted_at: new Date().toISOString() })
      .eq("id", card.prediction_id);
  }

  // 6. Generar copy dinámico para la etapa destino
  const customerName = Array.isArray(card.customer)
    ? (card.customer as unknown as { name: string }[])[0]?.name
    : (card.customer as { name: string })?.name;
  const predictionObj = Array.isArray(card.prediction)
    ? (card.prediction as unknown as { message_text: string | null }[])[0]
    : (card.prediction as { message_text: string | null } | null);
  const originalMessage = predictionObj?.message_text ?? null;

  // Notas: la que acabamos de crear + las que ya existían
  const notesForCopy: { result: string; note_text: string | null; created_at: string }[] = [
    { result, note_text: noteText, created_at: new Date().toISOString() },
  ];

  await generateStageCopy(
    supabase,
    tenantId,
    cardId,
    targetColumn,
    customerName ?? "Cliente",
    card.vertical as Vertical,
    originalMessage,
    notesForCopy
  );

  return Response.json({
    success: true,
    message: result === "pidio_cotizacion"
      ? "Movido a Por cotizar"
      : "Seguimientos programados",
  } satisfies PipelineResponse);
}

// ============================================================
// Claude: ajuste inteligente de seguimientos
// ============================================================

interface ClaudeFollowupResult {
  days: number[];
  target_column: ColumnName | null;
}

/**
 * Llama a Claude Sonnet para que analice la nota del vendedor y ajuste
 * los plazos de seguimiento. Si Claude falla → retorna null (fallback a secuencia fija).
 */
async function adjustFollowupsWithClaude(
  supabase: SupabaseClient,
  tenantId: string,
  noteText: string,
  vertical: Vertical,
  customerName: string,
  contactResult: ContactResult,
  defaultSequence: readonly number[]
): Promise<ClaudeFollowupResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Sos un asistente de ventas B2B. Un vendedor acaba de contactar a un cliente y dejo esta nota:

Cliente: ${customerName}
Vertical: ${vertical}
Resultado del contacto: ${contactResult}
Nota del vendedor: "${noteText}"

Secuencia de seguimiento por defecto (dias desde hoy): [${defaultSequence.join(", ")}]

Analiza la nota y responde SOLO con un JSON (sin markdown, sin explicacion):
{
  "days": [numeros],
  "target_column": null o "por_cotizar"
}

Reglas:
- Si la nota menciona una fecha especifica o "la semana que viene", "el lunes", etc → ajusta los dias acorde
- Si la nota dice que pidio presupuesto/cotizacion → target_column: "por_cotizar", days: []
- Si la nota no tiene info util para ajustar → devuelve los dias por defecto tal cual
- "days" son dias desde hoy (enteros positivos), maximo 3 valores
- Si solo hace falta 1 seguimiento, devuelve 1 solo numero en days`;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: process.env.CHAT_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    totalInputTokens = response.usage.input_tokens;
    totalOutputTokens = response.usage.output_tokens;

    // Extraer texto de la respuesta
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock) return null;

    // Parsear JSON de Claude
    const parsed = JSON.parse(textBlock.text.trim()) as {
      days?: number[];
      target_column?: string | null;
    };

    // Validar resultado
    const days = Array.isArray(parsed.days)
      ? parsed.days.filter((d): d is number => typeof d === "number" && d > 0).slice(0, 3)
      : [];

    const validColumns: ColumnName[] = ["por_cotizar", "cotizacion_enviada"];
    const targetColumn = parsed.target_column && validColumns.includes(parsed.target_column as ColumnName)
      ? (parsed.target_column as ColumnName)
      : null;

    return { days, target_column: targetColumn };
  } catch (err) {
    console.error("Error en Claude followup adjustment:", err);
    return null; // Fallback a secuencia fija
  } finally {
    // Registrar uso en chat_usage (tiene permisos authenticated + RLS)
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      const totalTokens = totalInputTokens + totalOutputTokens;
      const costUsd =
        totalInputTokens * COST_PER_INPUT_TOKEN +
        totalOutputTokens * COST_PER_OUTPUT_TOKEN;

      await supabase.from("chat_usage").insert({
        tenant_id: tenantId,
        question: `[pipeline] Ajuste seguimiento: ${noteText.substring(0, 100)}`,
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        tokens_total: totalTokens,
        cost_usd: costUsd,
      });
    }
  }
}

// ============================================================
// Claude: copy dinámico por etapa
// ============================================================

/** Etapas donde se genera copy dinámico */
const STAGE_COPY_COLUMNS: ColumnName[] = ["en_seguimiento", "por_cotizar", "cotizacion_enviada"];

/** Intención del mensaje según la etapa */
const STAGE_INTENTIONS: Record<string, string> = {
  en_seguimiento: "Follow-up calido. Referir a la conversacion anterior, mantener el interes del cliente, preguntar si tiene novedades.",
  por_cotizar: "Confirmar que se esta preparando la cotizacion. Si faltan datos, pedirlos. Transmitir profesionalismo y rapidez.",
  cotizacion_enviada: "Recordar la cotizacion enviada, preguntar si tiene dudas, generar urgencia suave para cerrar la venta.",
};

/**
 * Genera un copy de venta adaptado a la etapa actual del pipeline.
 * Usa el historial de notas para personalizar el mensaje.
 * Si falla → no actualiza (se mantiene el copy anterior o el original).
 */
async function generateStageCopy(
  supabase: SupabaseClient,
  tenantId: string,
  cardId: string,
  targetColumn: ColumnName,
  customerName: string,
  vertical: Vertical,
  originalMessage: string | null,
  notes: { result: string; note_text: string | null; created_at: string }[]
): Promise<void> {
  // Solo generar para etapas que lo necesitan
  if (!STAGE_COPY_COLUMNS.includes(targetColumn)) {
    console.log(`[stage-copy] Etapa ${targetColumn} no requiere copy — skip`);
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[stage-copy] ANTHROPIC_API_KEY no disponible — no se puede generar copy");
    return;
  }

  // Verificar cache: si ya existe copy para esta etapa, no regenerar
  const { data: currentCard } = await supabase
    .from("pipeline_cards")
    .select("stage_messages")
    .eq("id", cardId)
    .single();

  const existingMessages = (currentCard?.stage_messages as Record<string, string>) ?? {};
  if (existingMessages[targetColumn]) {
    console.log(`[stage-copy] Cache hit para card=${cardId} etapa=${targetColumn} — no regenera`);
    return;
  }

  const intention = STAGE_INTENTIONS[targetColumn] ?? "";

  // Formatear notas para el prompt (más recientes primero, máximo 5)
  const notesText = notes
    .slice(0, 5)
    .map((n) => {
      const result = n.result === "contesto" ? "Contestó" : n.result === "no_contesto" ? "No contestó" : "Pidió cotización";
      const noteDetail = n.note_text ? ` — "${n.note_text}"` : "";
      return `- ${result}${noteDetail}`;
    })
    .join("\n");

  const prompt = `Sos un asistente de ventas B2B mayorista en Argentina. Genera un mensaje de WhatsApp para un vendedor que va a contactar a su cliente.

Cliente: ${customerName}
Tipo de oportunidad: ${vertical}
Etapa actual: ${targetColumn}

${originalMessage ? `Mensaje original (primer contacto):\n"${originalMessage}"\n` : ""}
${notesText ? `Historial de interacciones:\n${notesText}\n` : ""}
Intencion del mensaje: ${intention}

Genera SOLO el mensaje (sin comillas, sin explicacion, sin "Hola" duplicado). 2-4 oraciones, tono profesional pero cercano, para WhatsApp. Si hay notas con contexto especifico (ej: "va a consultar con su socio"), referir a ese contexto directamente.`;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  console.log(`[stage-copy] Generando copy para card=${cardId} etapa=${targetColumn} cliente=${customerName}`);

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: process.env.CHAT_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    totalInputTokens = response.usage.input_tokens;
    totalOutputTokens = response.usage.output_tokens;

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    if (!textBlock || !textBlock.text.trim()) {
      console.warn(`[stage-copy] Claude respondio sin texto para card=${cardId}`);
      return;
    }

    console.log(`[stage-copy] Claude genero ${textBlock.text.trim().length} chars para card=${cardId}`);

    // Merge el copy nuevo con los existentes (cache por etapa)
    const updatedMessages = { ...existingMessages, [targetColumn]: textBlock.text.trim() };

    const { error: updateError } = await supabase
      .from("pipeline_cards")
      .update({ stage_messages: updatedMessages })
      .eq("id", cardId);

    if (updateError) {
      console.error(`[stage-copy] Error UPDATE stage_messages card=${cardId}:`, updateError);
    } else {
      console.log(`[stage-copy] UPDATE exitoso para card=${cardId} etapa=${targetColumn}`);
    }
  } catch (err) {
    console.error("[stage-copy] Error generando stage copy:", err);
    // Fallback silencioso: se mantiene el copy anterior
  } finally {
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      const totalTokens = totalInputTokens + totalOutputTokens;
      const costUsd =
        totalInputTokens * COST_PER_INPUT_TOKEN +
        totalOutputTokens * COST_PER_OUTPUT_TOKEN;

      await supabase.from("chat_usage").insert({
        tenant_id: tenantId,
        question: `[pipeline] Copy etapa ${targetColumn}: ${customerName}`,
        tokens_input: totalInputTokens,
        tokens_output: totalOutputTokens,
        tokens_total: totalTokens,
        cost_usd: costUsd,
      });
    }
  }
}

/**
 * Helper: obtiene datos de la card + notas de la DB y genera copy.
 * Usado por handleCompleteFollowup y handleAdvance donde no se tienen los datos a mano.
 */
async function generateStageCopyForCard(
  supabase: SupabaseClient,
  tenantId: string,
  cardId: string,
  targetColumn: ColumnName
): Promise<void> {
  console.log(`[stage-copy-for-card] Iniciando para card=${cardId} etapa=${targetColumn}`);

  // Obtener card con cliente, prediction y cache de copies
  const { data: card, error: cardError } = await supabase
    .from("pipeline_cards")
    .select("vertical, stage_messages, customer:customers!inner(name), prediction:predictions(message_text)")
    .eq("id", cardId)
    .single();

  if (cardError) {
    console.error(`[stage-copy-for-card] Error obteniendo card=${cardId}:`, cardError);
    return;
  }

  if (!card) {
    console.warn(`[stage-copy-for-card] Card no encontrada: ${cardId}`);
    return;
  }

  const customerName = Array.isArray(card.customer)
    ? (card.customer as unknown as { name: string }[])[0]?.name
    : (card.customer as { name: string })?.name;
  const predictionObj = Array.isArray(card.prediction)
    ? (card.prediction as unknown as { message_text: string | null }[])[0]
    : (card.prediction as { message_text: string | null } | null);

  // Obtener notas recientes
  const { data: notes } = await supabase
    .from("contact_notes")
    .select("result, note_text, created_at")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false })
    .limit(5);

  await generateStageCopy(
    supabase,
    tenantId,
    cardId,
    targetColumn,
    customerName ?? "Cliente",
    card.vertical as Vertical,
    predictionObj?.message_text ?? null,
    notes ?? []
  );
}

/** Completar un seguimiento: registrar nota + marcar followup + avanzar si es el ultimo */
async function handleCompleteFollowup(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;
  const followupId = body.followup_id as string;
  const result = body.result as ContactResult;
  const noteText = (body.note_text as string) || null;

  if (!cardId || !followupId || !result) {
    return Response.json(
      { error: "card_id, followup_id y result son requeridos" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // 1. Marcar followup como completado
  const { error: followupError } = await supabase
    .from("followups")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", followupId);

  if (followupError) {
    console.error("Error completing followup:", followupError);
    return Response.json(
      { error: "Error al completar el seguimiento" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 2. Registrar nota de contacto
  const { error: noteError } = await supabase.from("contact_notes").insert({
    tenant_id: tenantId,
    card_id: cardId,
    result,
    note_text: noteText,
    followup_id: followupId,
  });

  if (noteError) {
    console.error("Error creating note for followup:", noteError);
  }

  // 3. Si "pidio_cotizacion", saltar remaining followups y mover a "por_cotizar"
  if (result === "pidio_cotizacion") {
    // Marcar followups pendientes como skipped
    await supabase
      .from("followups")
      .update({ status: "skipped" })
      .eq("card_id", cardId)
      .eq("status", "pending");

    // Mover card
    await supabase
      .from("pipeline_cards")
      .update({ column_name: "por_cotizar" })
      .eq("id", cardId);

    // Generar copy para "por_cotizar"
    await generateStageCopyForCard(supabase, tenantId, cardId, "por_cotizar");

    return Response.json({
      success: true,
      message: "Movido a Por cotizar",
    } satisfies PipelineResponse);
  }

  // 4. Si todos los followups estan completados/skipped, la card se queda
  //    en "en_seguimiento" hasta que el vendedor la mueva manualmente
  return Response.json({
    success: true,
    message: "Seguimiento completado",
  } satisfies PipelineResponse);
}

/** Descartar card: elimina del pipeline y marca prediction como "ignored" */
async function handleDiscard(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;

  if (!cardId) {
    return Response.json(
      { error: "card_id es requerido" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // 1. Obtener prediction_id antes de borrar
  const { data: card } = await supabase
    .from("pipeline_cards")
    .select("prediction_id")
    .eq("id", cardId)
    .single();

  // 2. Borrar followups y notas asociados (cascade via FK, pero por si acaso)
  await supabase.from("contact_notes").delete().eq("card_id", cardId);
  await supabase.from("followups").delete().eq("card_id", cardId);

  // 3. Borrar la card del pipeline
  const { error } = await supabase
    .from("pipeline_cards")
    .delete()
    .eq("id", cardId);

  if (error) {
    console.error("Error discarding card:", error);
    return Response.json(
      { error: "Error al descartar la card" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 4. Marcar prediction como "ignored"
  if (card?.prediction_id) {
    await supabase
      .from("predictions")
      .update({ status: "ignored" })
      .eq("id", card.prediction_id);
  }

  return Response.json({
    success: true,
    message: "Card descartada",
  } satisfies PipelineResponse);
}

/** Agregar nota sin mover la card (usado en "contactado" y como accion libre) */
async function handleAddNote(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;
  const noteText = (body.note_text as string) || null;

  if (!cardId || !noteText) {
    return Response.json(
      { error: "card_id y note_text son requeridos" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase.from("contact_notes").insert({
    tenant_id: tenantId,
    card_id: cardId,
    result: "contesto" as const, // default para notas libres
    note_text: noteText,
  });

  if (error) {
    console.error("Error adding note:", error);
    return Response.json(
      { error: "Error al agregar la nota" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Nota agregada",
  } satisfies PipelineResponse);
}

/** Avanzar card a la siguiente etapa (por_cotizar→cotizacion_enviada, cotizacion_enviada→vendido) */
async function handleAdvance(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const cardId = body.card_id as string;
  const targetColumn = body.to_column as ColumnName;
  const noteText = (body.note_text as string) || null;

  if (!cardId || !targetColumn) {
    return Response.json(
      { error: "card_id y to_column son requeridos" } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // Validar transiciones permitidas
  const validTargets: ColumnName[] = ["cotizacion_enviada", "vendido"];
  if (!validTargets.includes(targetColumn)) {
    return Response.json(
      { error: `Destino invalido para advance: ${targetColumn}` } satisfies PipelineErrorResponse,
      { status: 400 }
    );
  }

  // 1. Mover la card
  const { error: moveError } = await supabase
    .from("pipeline_cards")
    .update({ column_name: targetColumn })
    .eq("id", cardId);

  if (moveError) {
    console.error("Error advancing card:", moveError);
    return Response.json(
      { error: "Error al avanzar la card" } satisfies PipelineErrorResponse,
      { status: 500 }
    );
  }

  // 2. Registrar nota si hay
  if (noteText) {
    await supabase.from("contact_notes").insert({
      tenant_id: tenantId,
      card_id: cardId,
      result: "contesto" as const,
      note_text: noteText,
    });
  }

  // 3. Si llega a "vendido", marcar prediction como "completed"
  if (targetColumn === "vendido") {
    const { data: card } = await supabase
      .from("pipeline_cards")
      .select("prediction_id")
      .eq("id", cardId)
      .single();

    if (card?.prediction_id) {
      await supabase
        .from("predictions")
        .update({ status: "completed" })
        .eq("id", card.prediction_id);
    }

    // Marcar followups pendientes como skipped
    await supabase
      .from("followups")
      .update({ status: "skipped" })
      .eq("card_id", cardId)
      .eq("status", "pending");
  }

  // 4. Generar copy dinámico para la etapa destino (no aplica a "vendido")
  await generateStageCopyForCard(supabase, tenantId, cardId, targetColumn);

  return Response.json({
    success: true,
    message: targetColumn === "vendido" ? "Venta cerrada" : "Cotizacion enviada",
  } satisfies PipelineResponse);
}
