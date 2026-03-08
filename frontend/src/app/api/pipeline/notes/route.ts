import { createClient } from "@/lib/supabase/server";

// DELETE /api/pipeline/notes — Borrar una nota por ID
export async function DELETE(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { note_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalido" }, { status: 400 });
  }

  const noteId = body.note_id;
  if (!noteId) {
    return Response.json({ error: "note_id es requerido" }, { status: 400 });
  }

  const { error } = await supabase
    .from("contact_notes")
    .delete()
    .eq("id", noteId);

  if (error) {
    console.error("Error deleting note:", error);
    return Response.json({ error: "Error al borrar la nota" }, { status: 500 });
  }

  return Response.json({ success: true });
}

// GET /api/pipeline/notes?card_id=xxx — Obtener todas las notas de una card
export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
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

  return Response.json({ notes: notes ?? [] });
}
