import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Cloud,
  FileSpreadsheet,
  CircleDashed,
} from "lucide-react";

type ErpStatus = "connected" | "outdated" | "error" | "not_configured" | "file_only";

interface ErpStatusInfo {
  status: ErpStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

interface ErpStatusCardProps {
  erpType: string | null;
  hasCredentials: boolean;
  lastSync: {
    status: string;
    started_at: string;
    customers_synced: number | null;
    products_synced: number | null;
    orders_synced: number | null;
  } | null;
}

function getErpStatus(props: ErpStatusCardProps): ErpStatusInfo {
  const { erpType, hasCredentials, lastSync } = props;

  if (erpType === "excel") {
    return {
      status: "file_only",
      label: "Canal: Subida de archivos",
      description: "Los datos se cargan via Smart File Upload o Google Drive.",
      icon: FileSpreadsheet,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/15",
      borderClass: "border-blue-500/30",
    };
  }

  if (!erpType || !hasCredentials) {
    return {
      status: "not_configured",
      label: "No configurado",
      description: "Credenciales ERP no configuradas. Contactar administrador.",
      icon: CircleDashed,
      colorClass: "text-white/50",
      bgClass: "bg-white/[0.06]",
      borderClass: "border-white/[0.1]",
    };
  }

  if (lastSync && lastSync.status === "failed") {
    return {
      status: "error",
      label: "Error de conexion",
      description: "El ultimo sync fallo. Verificar credenciales y conexion.",
      icon: XCircle,
      colorClass: "text-red-400",
      bgClass: "bg-red-500/15",
      borderClass: "border-red-500/30",
    };
  }

  if (lastSync) {
    const lastSyncDate = new Date(lastSync.started_at);
    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync > 48) {
      return {
        status: "outdated",
        label: "Desactualizado",
        description: `Ultimo sync hace ${Math.floor(hoursSinceSync / 24)} dias.`,
        icon: AlertTriangle,
        colorClass: "text-yellow-400",
        bgClass: "bg-yellow-500/15",
        borderClass: "border-yellow-500/30",
      };
    }

    return {
      status: "connected",
      label: "Conectado",
      description: "Datos sincronizados correctamente.",
      icon: CheckCircle,
      colorClass: "text-green-400",
      bgClass: "bg-green-500/15",
      borderClass: "border-green-500/30",
    };
  }

  return {
    status: "not_configured",
    label: "Pendiente",
    description: "Credenciales configuradas. Esperando primer sync.",
    icon: CircleDashed,
    colorClass: "text-white/50",
    bgClass: "bg-white/[0.06]",
    borderClass: "border-white/[0.1]",
  };
}

function formatErpType(erpType: string | null): string {
  if (!erpType) return "No definido";
  const names: Record<string, string> = {
    contabilium: "Contabilium",
    excel: "Excel / Archivos",
    xubio: "Xubio",
    alegra: "Alegra",
    colppy: "Colppy",
    custom: "Custom",
  };
  return names[erpType] || erpType;
}

function formatSyncDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return "Hace menos de 1 hora";
  if (diffHours < 24) return `Hace ${Math.floor(diffHours)} horas`;
  if (diffHours < 48) return "Ayer";
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ErpStatusCard({ erpType, hasCredentials, lastSync }: ErpStatusCardProps) {
  const info = getErpStatus({ erpType, hasCredentials, lastSync });
  const StatusIcon = info.icon;

  return (
    <div className={`rounded-2xl border ${info.borderClass} ${info.bgClass} p-4`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Cloud className="h-5 w-5 text-white/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Conexion ERP</h2>
            <div className="flex items-center gap-1.5">
              <StatusIcon className={`h-4 w-4 ${info.colorClass}`} />
              <span className={`text-xs font-medium ${info.colorClass}`}>
                {info.label}
              </span>
            </div>
          </div>

          <p className="text-xs text-white/50 mt-1">{info.description}</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <span>Tipo: {formatErpType(erpType)}</span>
            {lastSync && (
              <>
                <span>Sync: {formatSyncDate(lastSync.started_at)}</span>
                {lastSync.customers_synced != null && (
                  <span>
                    {lastSync.customers_synced}C / {lastSync.products_synced ?? 0}P / {lastSync.orders_synced ?? 0}O
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
