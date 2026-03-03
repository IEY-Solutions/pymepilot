import { createClient } from "@/lib/supabase/server";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
} from "lucide-react";
import { FileUpload } from "@/components/upload/file-upload";
import { DriveConnection } from "@/components/drive/drive-connection";
import { ErpStatusCard } from "@/components/datos/erp-status-card";
import { getFreshnessInfo } from "@/lib/freshness";

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

  // Queries en paralelo (+ upload_jobs recientes + tenant info)
  const [syncsRes, customersRes, productsRes, ordersRes, predictionsRes, uploadsRes, driveRes, tenantRes] =
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
      supabase
        .from("upload_jobs")
        .select("id, status, file_paths, created_at, completed_at, error_message")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("drive_connections")
        .select("id, folder_id, status, last_synced_at, error_message")
        .limit(1)
        .maybeSingle(),
      // VIEW tenant_info_secure: solo columnas seguras, filtrada por JWT.
      // NO expone erp_config (que contiene client_id + client_secret_encrypted).
      supabase
        .from("tenant_info_secure")
        .select("erp_type, has_erp_credentials")
        .maybeSingle(),
    ]);

  const syncs = syncsRes.data ?? [];
  const uploads = uploadsRes.data ?? [];
  const driveConnection = driveRes.data ?? null;
  const lastSync = syncs[0];
  const tenantData = tenantRes.data as { erp_type: string | null; has_erp_credentials: boolean } | null;

  // Datos para la card de ERP (derivados de VIEW segura, sin erp_config)
  const erpType = tenantData?.erp_type ?? null;
  const hasCredentials = tenantData?.has_erp_credentials ?? false;

  // Ultimo sync exitoso (para la card de ERP)
  const lastSuccessfulSync = syncs.find((s) => s.status === "completed") ?? null;

  // Indicador de frescura
  const freshness = getFreshnessInfo(lastSync?.started_at ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Estado de Datos</h1>

      {/* Card de estado ERP */}
      <ErpStatusCard
        erpType={erpType}
        hasCredentials={hasCredentials}
        lastSync={lastSuccessfulSync ? {
          status: lastSuccessfulSync.status,
          started_at: lastSuccessfulSync.started_at,
          customers_synced: lastSuccessfulSync.customers_synced,
          products_synced: lastSuccessfulSync.products_synced,
          orders_synced: lastSuccessfulSync.orders_synced,
        } : null}
      />

      {/* Indicador de frescura mejorado */}
      {freshness && (
        <div className={`flex items-center justify-between gap-3 p-4 ${freshness.bgClass} border ${freshness.borderClass} rounded-lg`}>
          <div className="flex items-center gap-3">
            {freshness.color === "green" ? (
              <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            ) : freshness.color === "yellow" ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${freshness.textClass}`}>
                {freshness.label}
              </p>
              <p className={`text-xs ${freshness.textClass} opacity-80 mt-0.5`}>
                {freshness.message}
              </p>
            </div>
          </div>
          {freshness.color !== "green" && (
            <a
              href="#upload-section"
              className={`text-xs ${freshness.textClass} underline shrink-0`}
            >
              Actualizar datos
            </a>
          )}
        </div>
      )}

      {/* Smart File Upload (Canal 2) */}
      <FileUpload />

      {/* Google Drive (Canal 3) */}
      <DriveConnection connection={driveConnection} />

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

      {/* Uploads recientes */}
      {uploads.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Uploads recientes
          </h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {uploads.map((upload) => {
              const config = statusConfig[upload.status] ?? statusConfig.started;
              const StatusIcon = config.icon;
              const filePaths = upload.file_paths as { name: string }[];
              const fileNames = filePaths?.map((f) => f.name).join(", ") ?? "";
              return (
                <div
                  key={upload.id}
                  className="p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 max-w-xs truncate">
                        {fileNames}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(upload.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{config.label}</p>
                    {upload.error_message && (
                      <p className="text-red-500 mt-0.5 max-w-48 truncate">
                        Error en procesamiento
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        Error en sincronizacion
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
