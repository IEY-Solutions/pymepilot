import { createClient } from "@/lib/supabase/server";
import { PredictionCard } from "@/components/predictions/prediction-card";
import { MessageSquare } from "lucide-react";

export default async function ContactarPage() {
  const supabase = await createClient();

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select(
      "id, vertical, prediction_date, contact_date, message_text, confidence_score, priority, status, customer:customers!inner(name, phone, email, last_purchase_date)"
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

  const pending = predictions?.filter((p) => p.status === "pending") ?? [];
  const contacted = predictions?.filter((p) => p.status === "contacted") ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contactar Hoy</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
            {contacted.length > 0 &&
              ` | ${contacted.length} contactado${contacted.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {predictions?.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            No hay predicciones para hoy
          </p>
          <p className="text-sm text-gray-400 mt-1">
            El motor genera predicciones cada dia a las 5 AM
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {predictions?.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              prediction={{
                ...prediction,
                status: prediction.status as "pending" | "contacted" | "ignored",
                customer: Array.isArray(prediction.customer)
                  ? prediction.customer[0]
                  : prediction.customer,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
