import { createClient } from "@/lib/supabase/server";
import type {
  KeyAccountAlert,
  AlertStatus,
  KeyAccountsErrorResponse,
  KeyAccountsActionResponse,
} from "@/lib/key-accounts/types";

// ============================================================
// GET /api/key-accounts/alerts — Alertas activas de una cuenta clave
// POST /api/key-accounts/alerts — Acciones: resolve, dismiss, create_manual
// ============================================================

// ------------------------------------------------------------
// GET: Alertas activas (pending + triggered)
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

  const { data: alerts, error } = await supabase
    .from("key_account_alerts")
    .select(
      "id, key_account_id, alert_type, title, description, trigger_rule, trigger_date, status, source_note_id, created_at, resolved_at"
    )
    .eq("key_account_id", keyAccountId)
    .in("status", ["pending", "triggered"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching key account alerts:", error);
    return Response.json(
      { error: "Error al cargar alertas" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({ alerts: (alerts ?? []) as KeyAccountAlert[] });
}

// ------------------------------------------------------------
// POST: Acciones sobre alertas
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
    case "resolve":
      return handleResolve(supabase, body);
    case "dismiss":
      return handleDismiss(supabase, body);
    case "create_manual":
      return handleCreateManual(supabase, tenantId, body);
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

/** Resolver una alerta (marcar como resuelta) */
async function handleResolve(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const alertId = body.alert_id as string;

  if (!alertId) {
    return Response.json(
      { error: "alert_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // Obtener key_account_id antes de actualizar
  const { data: alert } = await supabase
    .from("key_account_alerts")
    .select("key_account_id")
    .eq("id", alertId)
    .single();

  const { error } = await supabase
    .from("key_account_alerts")
    .update({
      status: "resolved" as AlertStatus,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    console.error("Error resolving alert:", error);
    return Response.json(
      { error: "Error al resolver alerta" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // Decrementar contador
  if (alert) {
    await decrementPendingActions(supabase, alert.key_account_id);
  }

  return Response.json({
    success: true,
    message: "Alerta resuelta",
  } satisfies KeyAccountsActionResponse);
}

/** Descartar una alerta */
async function handleDismiss(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const alertId = body.alert_id as string;

  if (!alertId) {
    return Response.json(
      { error: "alert_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // Obtener key_account_id antes de actualizar
  const { data: alert } = await supabase
    .from("key_account_alerts")
    .select("key_account_id")
    .eq("id", alertId)
    .single();

  const { error } = await supabase
    .from("key_account_alerts")
    .update({ status: "dismissed" as AlertStatus })
    .eq("id", alertId);

  if (error) {
    console.error("Error dismissing alert:", error);
    return Response.json(
      { error: "Error al descartar alerta" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // Decrementar contador
  if (alert) {
    await decrementPendingActions(supabase, alert.key_account_id);
  }

  return Response.json({
    success: true,
    message: "Alerta descartada",
  } satisfies KeyAccountsActionResponse);
}

/** Crear alerta manual */
async function handleCreateManual(
  supabase: SupabaseClient,
  tenantId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const keyAccountId = body.key_account_id as string;
  const title = body.title as string;
  const description = (body.description as string) || null;
  const triggerDate = (body.trigger_date as string) || null;

  if (!keyAccountId || !title) {
    return Response.json(
      { error: "key_account_id y title son requeridos" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("key_account_alerts")
    .insert({
      tenant_id: tenantId,
      key_account_id: keyAccountId,
      alert_type: "manual",
      title,
      description,
      trigger_date: triggerDate,
      status: "pending",
    });

  if (error) {
    console.error("Error creating manual alert:", error);
    return Response.json(
      { error: "Error al crear alerta" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // Incrementar contador
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
    message: "Alerta creada",
  } satisfies KeyAccountsActionResponse);
}

/** Helper: decrementar pending_actions_count */
async function decrementPendingActions(
  supabase: SupabaseClient,
  keyAccountId: string
): Promise<void> {
  const { data: account } = await supabase
    .from("key_accounts")
    .select("pending_actions_count")
    .eq("id", keyAccountId)
    .single();

  if (account) {
    await supabase
      .from("key_accounts")
      .update({
        pending_actions_count: Math.max(0, (account.pending_actions_count ?? 0) - 1),
      })
      .eq("id", keyAccountId);
  }
}
