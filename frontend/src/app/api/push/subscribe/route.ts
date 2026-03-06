import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verificar autenticacion
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON invalido" }, { status: 400 });
  }

  const { endpoint, keys } = body;

  // Validar campos requeridos
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json(
      { error: "Faltan campos: endpoint, keys.p256dh, keys.auth" },
      { status: 400 }
    );
  }

  // Validar que endpoint sea HTTPS
  if (!endpoint.startsWith("https://")) {
    return Response.json(
      { error: "El endpoint debe ser HTTPS" },
      { status: 400 }
    );
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return Response.json(
      { error: "tenant_id no encontrado en el perfil" },
      { status: 400 }
    );
  }

  // Upsert: si ya existe el endpoint para este tenant, actualizar keys
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      tenant_id: tenantId,
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    {
      onConflict: "tenant_id,endpoint",
    }
  );

  if (error) {
    console.error("Error saving push subscription:", error.message);
    return Response.json(
      { error: "Error al guardar suscripcion" },
      { status: 500 }
    );
  }

  return Response.json({ ok: true });
}
