import { createClient } from "@/lib/supabase/server";
import type {
  KeyAccount,
  HealthScore,
  KeyAccountsErrorResponse,
  KeyAccountsActionResponse,
} from "@/lib/key-accounts/types";

// ============================================================
// GET /api/key-accounts — Obtener todas las cuentas clave activas
// POST /api/key-accounts — Acciones: add, archive, update_health_override, restore_auto_health
// ============================================================

// ------------------------------------------------------------
// GET: Fetch cuentas clave con datos enriquecidos
// ------------------------------------------------------------
export async function GET(): Promise<Response> {
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

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) {
    return Response.json(
      { error: "tenant_id no encontrado en el perfil" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // 1. Fetch key_accounts activas con join a customers
  const { data: accounts, error } = await supabase
    .from("key_accounts")
    .select(
      `id, tenant_id, customer_id, status, health_score, health_override,
       source, notes_count, pending_actions_count, created_at, created_by,
       customer:customers!inner(name, phone, email, total_purchases_amount, last_purchase_date)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching key accounts:", error);
    return Response.json(
      { error: "Error al cargar cuentas clave" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  if (!accounts || accounts.length === 0) {
    return Response.json({ accounts: [] });
  }

  const accountIds = accounts.map((a) => a.id);

  // 2. Fetch ultima nota y alertas activas en paralelo
  const [notesRes, alertsRes] = await Promise.all([
    supabase
      .from("key_account_notes")
      .select("key_account_id, note_type, created_at")
      .in("key_account_id", accountIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("key_account_alerts")
      .select("key_account_id, status, trigger_date")
      .in("key_account_id", accountIds)
      .in("status", ["pending", "triggered"]),
  ]);

  // 3. Agrupar ultima nota por account
  const lastNoteByAccount = new Map<string, { date: string; type: string }>();
  for (const n of notesRes.data ?? []) {
    if (!lastNoteByAccount.has(n.key_account_id)) {
      lastNoteByAccount.set(n.key_account_id, {
        date: n.created_at,
        type: n.note_type,
      });
    }
  }

  // 4. Contar alertas activas y verificar seguimiento futuro por account
  const alertsByAccount = new Map<string, { count: number; hasFuture: boolean }>();
  const now = new Date();
  for (const a of alertsRes.data ?? []) {
    const existing = alertsByAccount.get(a.key_account_id) ?? { count: 0, hasFuture: false };
    existing.count++;
    if (a.trigger_date && new Date(a.trigger_date) > now) {
      existing.hasFuture = true;
    }
    alertsByAccount.set(a.key_account_id, existing);
  }

  // 5. Recalcular health_score en batch (un solo roundtrip via RPC)
  // La funcion recalculate_key_account_health_scores actualiza en la DB
  // y retorna los nuevos scores para que podamos ensamblar la respuesta.
  const healthUpdateMap = new Map<string, HealthScore>();

  // La funcion usa get_current_tenant_id() internamente — no pasamos tenant_id
  const { data: batchResults } = await supabase.rpc(
    "recalculate_key_account_health_scores"
  );

  if (batchResults && Array.isArray(batchResults)) {
    for (const row of batchResults) {
      healthUpdateMap.set(row.account_id, row.new_health_score as HealthScore);
    }
  }

  // Aplicar los health scores actualizados a los objetos en memoria
  for (const account of accounts) {
    if (!account.health_override && healthUpdateMap.has(account.id)) {
      account.health_score = healthUpdateMap.get(account.id)!;
    }
  }

  // 6. Ensamblar respuesta
  const enrichedAccounts: KeyAccount[] = accounts.map((a) => {
    const lastNote = lastNoteByAccount.get(a.id);
    const alerts = alertsByAccount.get(a.id) ?? { count: 0, hasFuture: false };

    return {
      ...a,
      customer: Array.isArray(a.customer)
        ? (a.customer as unknown as KeyAccount["customer"][])[0]
        : (a.customer as unknown as KeyAccount["customer"]),
      health_score: (a.health_override ?? a.health_score) as HealthScore,
      last_note_date: lastNote?.date ?? null,
      last_note_type: lastNote?.type as KeyAccount["last_note_type"] ?? null,
      active_alerts_count: alerts.count,
      has_future_alert: alerts.hasFuture,
    };
  });

  return Response.json({ accounts: enrichedAccounts });
}

// ------------------------------------------------------------
// POST: Acciones de cuentas clave
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
    case "add":
      return handleAdd(supabase, tenantId, user.id, body);
    case "add_new":
      return handleAddNew(supabase, tenantId, user.id, body);
    case "archive":
      return handleArchive(supabase, body);
    case "update_health_override":
      return handleUpdateHealthOverride(supabase, body);
    case "restore_auto_health":
      return handleRestoreAutoHealth(supabase, body);
    default:
      return Response.json(
        { error: `Accion desconocida: ${action}` } satisfies KeyAccountsErrorResponse,
        { status: 400 }
      );
  }
}

// ============================================================
// Helpers
// ============================================================

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Agregar un cliente como cuenta clave */
async function handleAdd(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const customerId = body.customer_id as string;
  const source = (body.source as string) || "manual";

  if (!customerId) {
    return Response.json(
      { error: "customer_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // Calcular health score inicial
  const { data: healthResult } = await supabase.rpc("get_key_account_health_score", {
    p_customer_id: customerId,
  });

  const { data: account, error } = await supabase
    .from("key_accounts")
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      source,
      health_score: (healthResult as HealthScore) ?? "green",
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json(
        { error: "Este cliente ya es cuenta clave" } satisfies KeyAccountsErrorResponse,
        { status: 409 }
      );
    }
    console.error("Error adding key account:", error);
    return Response.json(
      { error: "Error al agregar cuenta clave" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Cuenta clave agregada",
  } satisfies KeyAccountsActionResponse);
}

/** Archivar una cuenta clave */
async function handleArchive(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const accountId = body.account_id as string;

  if (!accountId) {
    return Response.json(
      { error: "account_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("key_accounts")
    .update({ status: "archived" })
    .eq("id", accountId);

  if (error) {
    console.error("Error archiving key account:", error);
    return Response.json(
      { error: "Error al archivar cuenta clave" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Cuenta clave archivada",
  } satisfies KeyAccountsActionResponse);
}

/** Override manual del semaforo */
async function handleUpdateHealthOverride(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const accountId = body.account_id as string;
  const override = body.health_override as HealthScore;

  if (!accountId || !override) {
    return Response.json(
      { error: "account_id y health_override son requeridos" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const validColors: HealthScore[] = ["green", "yellow", "red"];
  if (!validColors.includes(override)) {
    return Response.json(
      { error: "Color de semaforo invalido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("key_accounts")
    .update({ health_override: override, health_score: override })
    .eq("id", accountId);

  if (error) {
    console.error("Error updating health override:", error);
    return Response.json(
      { error: "Error al actualizar semaforo" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Semaforo actualizado",
  } satisfies KeyAccountsActionResponse);
}

/** Restaurar semaforo automatico (quitar override) */
async function handleRestoreAutoHealth(
  supabase: SupabaseClient,
  body: Record<string, unknown>
): Promise<Response> {
  const accountId = body.account_id as string;

  if (!accountId) {
    return Response.json(
      { error: "account_id es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // Obtener customer_id para recalcular
  const { data: account } = await supabase
    .from("key_accounts")
    .select("customer_id")
    .eq("id", accountId)
    .single();

  if (!account) {
    return Response.json(
      { error: "Cuenta clave no encontrada" } satisfies KeyAccountsErrorResponse,
      { status: 404 }
    );
  }

  // Recalcular health score
  const { data: healthResult } = await supabase.rpc("get_key_account_health_score", {
    p_customer_id: account.customer_id,
  });

  const { error } = await supabase
    .from("key_accounts")
    .update({
      health_override: null,
      health_score: (healthResult as HealthScore) ?? "green",
    })
    .eq("id", accountId);

  if (error) {
    console.error("Error restoring auto health:", error);
    return Response.json(
      { error: "Error al restaurar semaforo" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Semaforo restaurado a automatico",
  } satisfies KeyAccountsActionResponse);
}

/** Crear cliente nuevo + marcarlo como cuenta clave en un solo paso */
async function handleAddNew(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  body: Record<string, unknown>
): Promise<Response> {
  const name = (body.name as string)?.trim();
  const phone = (body.phone as string)?.trim() || null;
  const email = (body.email as string)?.trim() || null;

  if (!name) {
    return Response.json(
      { error: "El nombre es requerido" } satisfies KeyAccountsErrorResponse,
      { status: 400 }
    );
  }

  // 1. Crear el customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name,
      phone,
      email,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    console.error("Error creating customer:", customerError);
    return Response.json(
      { error: "Error al crear el cliente" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  // 2. Marcarlo como cuenta clave
  const { error: kaError } = await supabase
    .from("key_accounts")
    .insert({
      tenant_id: tenantId,
      customer_id: customer.id,
      source: "manual",
      health_score: "green",
      created_by: userId,
    });

  if (kaError) {
    console.error("Error adding key account:", kaError);
    return Response.json(
      { error: "Cliente creado pero error al marcarlo como cuenta clave" } satisfies KeyAccountsErrorResponse,
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    message: "Cliente creado y agregado como cuenta clave",
  } satisfies KeyAccountsActionResponse);
}

// Nota: handleDelete eliminado (H-01 — el boton de eliminar fue removido del UI).
// Las cuentas clave se archivan via handleArchive, no se eliminan.
