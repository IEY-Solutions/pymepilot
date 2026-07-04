import { createClient } from "@/lib/supabase/server";
import { truncateText, redactPii, NOTE_PREVIEW_MAX_LENGTH } from "@/lib/pii";
import { getLogger } from "@/lib/observability/logger";
import { emitAudit } from "@/lib/audit";
import {
  getSessionTenantId,
  getRequestTenantId,
  createTenantProbeEvent,
  createAccessDeniedEvent,
  getClientIp,
} from "@/lib/api-security";
import type { AuditEvent } from "@/lib/audit";
import type { SupabaseClient as SupabaseAuthClient } from "@supabase/supabase-js";

async function safeEmitAudit(
  client: SupabaseAuthClient,
  event: AuditEvent
): Promise<void> {
  try {
    await emitAudit(client, event);
  } catch (err) {
    getLogger().warn(
      {
        event: "audit.emit_failed",
        action: event.action,
        error: err instanceof Error ? err.message : String(err),
      },
      "Failed to emit audit event"
    );
  }
}

// DELETE /api/pipeline/notes — DESHABILITADO
// contact_notes es append-only por diseño (migration 056 revocó GRANT DELETE).
// Las notas se eliminan únicamente via ON DELETE CASCADE cuando se descarta
// la pipeline_card padre. No existe borrado individual de notas.
export async function DELETE(): Promise<Response> {
  return Response.json(
    { error: "Las notas del pipeline son append-only y no pueden borrarse individualmente." },
    { status: 405 }
  );
}

// GET /api/pipeline/notes?card_id=xxx — Obtener todas las notas de una card
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const correlationId = request.headers.get("x-correlation-id");

  if (!user) {
    await safeEmitAudit(
      supabase as unknown as SupabaseAuthClient,
      createAccessDeniedEvent("/api/pipeline/notes", correlationId, getClientIp(request))
    );
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const sessionTenantId = getSessionTenantId(user);
  const requestedTenantId = getRequestTenantId(request);
  if (requestedTenantId && requestedTenantId !== sessionTenantId) {
    await safeEmitAudit(
      supabase as unknown as SupabaseAuthClient,
      createTenantProbeEvent(user, requestedTenantId, "/api/pipeline/notes", correlationId)
    );
  }

  const url = new URL(request.url);
  const cardId = url.searchParams.get("card_id");

  if (!cardId) {
    return Response.json({ error: "card_id es requerido" }, { status: 400 });
  }

  const { data: notes, error } = await supabase
    .from("contact_notes")
    .select("id, card_id, result, note_text, followup_id, created_at")
    .eq("card_id", cardId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching notes:", error);
    return Response.json({ error: "Error al cargar notas" }, { status: 500 });
  }

  const sanitizedNotes = (notes ?? []).map((note) => ({
    ...note,
    note_text: redactPii(truncateText(note.note_text, NOTE_PREVIEW_MAX_LENGTH)),
  }));

  return Response.json({ notes: sanitizedNotes });
}
