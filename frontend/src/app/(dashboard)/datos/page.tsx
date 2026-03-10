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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { TOOLTIPS } from "@/lib/tooltips";

const statusConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  completed: { icon: CheckCircle, color: "text-green-400", label: "OK" },
  failed: { icon: XCircle, color: "text-red-400", label: "Error" },
  requires_review: { icon: AlertTriangle, color: "text-yellow-400", label: "Revisar" },
  started: { icon: Clock, color: "text-blue-400", label: "En curso" },
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
      supabase.rpc("get_tenant_info_secure"),
    ]);

  const syncs = syncsRes.data ?? [];
  const uploads = uploadsRes.data ?? [];
  const driveConnection = driveRes.data ?? null;
  const lastSync = syncs[0];
  const tenantRows = tenantRes.data as { erp_type: string | null; has_erp_credentials: boolean }[] | null;
  const tenantData = tenantRows?.[0] ?? null;

  const erpType = tenantData?.erp_type ?? null;
  const hasCredentials = tenantData?.has_erp_credentials ?? false;

  const lastSuccessfulSync = syncs.find((s) => s.status === "completed") ?? null;

  const freshness = getFreshnessInfo(lastSync?.started_at ?? null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Estado de Datos</h1>

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

      {freshness && (
        <div className={`flex items-center justify-between gap-3 p-4 ${freshness.bgClass} border ${freshness.borderClass} rounded-2xl`}>
          <div className="flex items-center gap-3">
            {freshness.color === "green" ? (
              <CheckCircle className="h-5 w-5 text-green-400 shrink-0" />
            ) : freshness.color === "yellow" ? (
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
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

      <FileUpload />

      <DriveConnection connection={driveConnection} />

      <div>
        <h2 className="text-sm font-medium text-white/50 mb-3">
          Registros en base de datos
          <InfoTooltip text={TOOLTIPS["datos.registros"]} />
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
              className="glass-dark p-3 flex items-center gap-3"
            >
              <Database className="h-4 w-4 text-white/40" />
              <div>
                <p className="text-lg font-semibold text-white">
                  {item.count}
                </p>
                <p className="text-xs text-white/50">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {uploads.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white/50 mb-3">
            Uploads recientes
          </h2>
          <div className="glass-dark divide-y divide-white/[0.06]">
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
                      <p className="text-sm font-medium text-white max-w-xs truncate">
                        {fileNames}
                      </p>
                      <p className="text-xs text-white/40">
                        {formatDate(upload.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-white/50">
                    <p>{config.label}</p>
                    {upload.error_message && (
                      <p className="text-red-400 mt-0.5 max-w-48 truncate">
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

      <div>
        <h2 className="text-sm font-medium text-white/50 mb-3">
          Ultimas sincronizaciones
        </h2>
        {syncs.length === 0 ? (
          <p className="text-white/40 text-sm">No hay sincronizaciones</p>
        ) : (
          <div className="glass-dark divide-y divide-white/[0.06]">
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
                      <p className="text-sm font-medium text-white">
                        {sync.source} ({sync.sync_type})
                      </p>
                      <p className="text-xs text-white/40">
                        {formatDate(sync.started_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-white/50">
                    <p>
                      {sync.customers_synced}C / {sync.products_synced}P /{" "}
                      {sync.orders_synced}O
                      <InfoTooltip text={TOOLTIPS["datos.sync_counts"]} />
                    </p>
                    {sync.error_message && (
                      <p className="text-red-400 mt-0.5 max-w-48 truncate">
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
