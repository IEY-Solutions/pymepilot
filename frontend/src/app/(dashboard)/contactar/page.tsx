import { createClient } from "@/lib/supabase/server";
import { ContactarContent } from "./contactar-content";
import type { ClientRanking } from "./contactar-content";

export default async function ContactarPage() {
  const supabase = await createClient();

  // Ventana de 3 dias: tolera fines de semana sin perder predicciones
  const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000)
    .toISOString()
    .split("T")[0];

  // Fetch predictions + rankings en paralelo
  const [predictionsRes, rankingsRes] = await Promise.all([
    supabase
      .from("predictions")
      .select(
        "id, vertical, prediction_date, contact_date, message_text, confidence_score, priority, status, metadata, customer_id, customer:customers!inner(name, phone, email, last_purchase_date)"
      )
      .in("status", ["pending", "contacted"])
      .gte("prediction_date", threeDaysAgo)
      .order("priority", { ascending: true })
      .order("contact_date", { ascending: true })
      .limit(50),
    supabase
      .from("client_rankings_secure")
      .select("customer_id, total_revenue"),
  ]);

  if (predictionsRes.error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Contactar Hoy
        </h1>
        <p className="text-red-600 bg-red-50 p-4 rounded-lg">
          Error al cargar predicciones. Intenta recargar la pagina.
        </p>
      </div>
    );
  }

  const normalizedPredictions = (predictionsRes.data ?? []).map((p) => ({
    ...p,
    customer: Array.isArray(p.customer)
      ? (p.customer as unknown as { name: string; phone: string | null; email: string | null; last_purchase_date: string | null }[])[0]
      : p.customer,
  }));

  const rankings: ClientRanking[] = rankingsRes.data ?? [];

  return (
    <ContactarContent
      predictions={normalizedPredictions}
      rankings={rankings}
    />
  );
}
