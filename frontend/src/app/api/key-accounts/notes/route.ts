import { createClient } from "@/lib/supabase/server";
import type {
  KeyAccountNote,
  NoteType,
  KeyAccountsErrorResponse,
  KeyAccountsActionResponse,
} from "@/lib/key-accounts/types";

// ============================================================
// GET /api/key-accounts/notes — Notas de una cuenta clave
// POST /api/key-accounts/notes — Acciones: create_note, create_followup
// ============================================================

// ------------------------------------------------------------
// GET: Notas de una cuenta clave
// ------------------------------------------------------------
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "No autenticado" } satisfies KeyAccountsErrorResponse,
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const keyAccountId = searchParams.get("key_account_id");

  if (!keyAccountId) {
    return Response.json(
      { error: "key_account_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const { data: notes, error } = await supabase
    .from("key_account_notes")
    .select("id, key_account_id, note_type, content, created_by, created_at")
    .eq("key_account_id", keyAccountId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching key account notes:", error);
    return Response.json(
      { error: "Error al cargar notas" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({ notes: (notes ?? []) as KeyAccountNote[] });
}

// ------------------------------------------------------------
// POST: Crear nota o seguimiento
// ------------------------------------------------------------
export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "No autenticado" } satisfies KeyAccountsErrorResponse,
      { status: 401 }
    );
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return Response.json(
      { error: "tenant_id no encontrado" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "JSON invalido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const action = body.action as string;

  switch (action) {
    case "create_note":
      return handleCreateNote(supabase, tenantId, user.id, body);
    case "create_followup":
      return handleCreateFollowup(supabase, tenantId, body);
    default:
      return Response.json(
        { error: `Accion desconocida: ${action}` } satisfies KeyAccountsErrorResponse,
        { status: 400 }
      );
  }
}

// ============================================================
// Handlers
// ============================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Crear nota con acciones opcionales */
async function handleCreateNote(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const keyAccountId = body.key_account_id as string;
  const noteType = body.note_type as NoteType;
  const content = body.content as string;
  const actions = body.actions as { title: string; trigger_date: string }[] | undefined;

  if (!keyAccountId || !noteType || !content) {
    return Response.json(
      { error: "key_account_id, note_type y content son requeridos" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const validTypes: NoteType[] = ["meeting", "call", "promise", "observation"];
  if (!validTypes.includes(noteType)) {
    return Response.json(
      { error: `Tipo de nota invalido: ${noteType}` } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // 1. Insertar nota
  const { data: note, error: noteError } = await supabase
    .from("key_account_notes")
    .insert({
      tenant_id: tenantId,
      key_account_id: keyAccountId,
      note_type: noteType,
      content,
      created_by: userId,
    })
    .select("id")
    .single();

  if (noteError || !note) {
    console.error("Error creating key account note:", JSON.stringify(noteError));
    console.error("Note insert payload:", JSON.stringify({ tenant_id: tenantId, key_account_id: keyAccountId, note_type: noteType, content: content?.substring(0, 50), created_by: userId }));
    return Response.json(
      { error: "Error al crear nota" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // 2. Crear alertas para cada accion (si hay)
  let actionsCreated = 0;
  if (actions && Array.isArray(actions) && actions.length > 0) {
    const alertsToInsert = actions
      .filter((a) => a.title && a.trigger_date)
      .slice(0, 5) // maximo 5 acciones por nota
      .map((a) => ({
        tenant_id: tenantId,
        key_account_id: keyAccountId,
        alert_type: "manual" as const,
        title: a.title,
        trigger_date: a.trigger_date,
        status: "pending" as const,
        source_note_id: note.id,
      }));

    if (alertsToInsert.length > 0) {
      const { error: alertError } = await supabase
        .from("key_account_alerts")
        .insert(alertsToInsert);

      if (alertError) {
        console.error("Error creating note actions:", JSON.stringify(alertError));
        console.error("Alerts payload:", JSON.stringify(alertsToInsert));
      } else {
        actionsCreated = alertsToInsert.length;
      }
    }
  }

  // 3. Actualizar contadores en key_accounts
  const { data: currentAccount } = await supabase
    .from("key_accounts")
    .select("notes_count, pending_actions_count")
    .eq("id", keyAccountId)
    .single();

  if (currentAccount) {
    await supabase
      .from("key_accounts")
      .update({
        notes_count: (currentAccount.notes_count ?? 0) + 1,
        pending_actions_count: (currentAccount.pending_actions_count ?? 0) + actionsCreated,
      })
      .eq("id", keyAccountId);
  }

  // 4. Verificar si hay alertas futuras (para nudge)
  const { data: futureAlerts } = await supabase
    .from("key_account_alerts")
    .select("id")
    .eq("key_account_id", keyAccountId)
    .in("status", ["pending", "triggered"])
    .gt("trigger_date", new Date().toISOString())
    .limit(1);

  const needsFollowup = !futureAlerts || futureAlerts.length === 0;

  return Response.json({
    success: true,
    message: actionsCreated > 0
      ? `Nota creada con ${actionsCreated} acciones`
      : "Nota creada",
    needs_followup: needsFollowup,
  } satisfies KeyAccountsActionResponse);
}

/** Crear seguimiento programado (desde nudge o manualmente) */
async function handleCreateFollowup(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const keyAccountId = body.key_account_id as string;
  const triggerDate = body.trigger_date as string;

  if (!keyAccountId || !triggerDate) {
    return Response.json(
      { error: "key_account_id y trigger_date son requeridos" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // Insertar alerta de seguimiento
  const { error } = await supabase
    .from("key_account_alerts")
    .insert({
      tenant_id: tenantId,
      key_account_id: keyAccountId,
      alert_type: "manual",
      title: "Seguimiento programado",
      trigger_date: triggerDate,
      status: "pending",
    });

  if (error) {
    console.error("Error creating followup:", error);
    return Response.json(
      { error: "Error al crear seguimiento" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // Actualizar contador
  const { data: currentAccount } = await supabase
    .from("key_accounts")
    .select("pending_actions_count")
    .eq("id", keyAccountId)
    .single();

  if (currentAccount) {
    await supabase
      .from("key_accounts")
      .update({
        pending_actions_count: (currentAccount.pending_actions_count ?? 0) + 1,
      })
      .eq("id", keyAccountId);
  }

  return Response.json({
    success: true,
    message: "Seguimiento programado",
  } satisfies KeyAccountsActionResponse);
}
