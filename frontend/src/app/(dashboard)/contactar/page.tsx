import { createClient } from "@/lib/supabase/server";
import { ContactarContent } from "./contactar-content";

export default async function ContactarPage() {
  const supabase = await createClient();

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select(
      "id, vertical, prediction_date, contact_date, message_text, confidence_score, priority, status, metadata, customer:customers!inner(name, phone, email, last_purchase_date)"
    )
    .in("status", ["pending", "contacted"])
    .order("priority", { ascending: true })
    .order("contact_date", { ascending: true })
    .limit(50);

  if (error) {
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

  const normalizedPredictions = (predictions ?? []).map((p) => ({
    ...p,
    customer: Array.isArray(p.customer)
      ? (p.customer as unknown as { name: string; phone: string | null; email: string | null; last_purchase_date: string | null }[])[0]
      : p.customer,
  }));

  return <ContactarContent predictions={normalizedPredictions} />;
}
