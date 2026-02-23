import { createClient } from "@/lib/supabase/server";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
} from "lucide-react";

const statusConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  completed: { icon: CheckCircle, color: "text-green-500", label: "OK" },
  failed: { icon: XCircle, color: "text-red-500", label: "Error" },
  requires_review: { icon: AlertTriangle, color: "text-yellow-500", label: "Revisar" },
  started: { icon: Clock, color: "text-blue-500", label: "En curso" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DatosPage() {
  const supabase = await createClient();

  // Queries en paralelo
  const [syncsRes, customersRes, productsRes, ordersRes, predictionsRes] =
    await Promise.all([
      supabase
        .from("sync_log")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true }),
    ]);

  const syncs = syncsRes.data ?? [];
  const lastSync = syncs[0];

  // Detectar si la ultima sync es muy vieja (>48h)
  const isStale =
    lastSync &&
    Date.now() - new Date(lastSync.started_at).getTime() > 48 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Estado de Datos</h1>

      {/* Alerta si datos viejos */}
      {isStale && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            La ultima sincronizacion fue hace mas de 48 horas. Los datos pueden
            no estar actualizados.
          </p>
        </div>
      )}

      {/* Conteo de registros */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Registros en base de datos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Clientes", count: customersRes.count ?? 0 },
            { label: "Productos", count: productsRes.count ?? 0 },
            { label: "Pedidos", count: ordersRes.count ?? 0 },
            { label: "Predicciones", count: predictionsRes.count ?? 0 },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3"
            >
              <Database className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {item.count}
                </p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ultimas sincronizaciones */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          Ultimas sincronizaciones
        </h2>
        {syncs.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay sincronizaciones</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {syncs.map((sync) => {
              const config = statusConfig[sync.status] ?? statusConfig.started;
              const StatusIcon = config.icon;
              return (
                <div
                  key={sync.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {sync.source} ({sync.sync_type})
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(sync.started_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>
                      {sync.customers_synced}C / {sync.products_synced}P /{" "}
                      {sync.orders_synced}O
                    </p>
                    {sync.error_message && (
                      <p className="text-red-500 mt-0.5 max-w-48 truncate">
                        {sync.error_message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
