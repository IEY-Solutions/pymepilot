import { createClient } from "@/lib/supabase/server";
import {
  UserCheck,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";

const statusConfig: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  pending: { icon: Clock, color: "text-blue-500", label: "Pendiente" },
  contacted: { icon: UserCheck, color: "text-green-500", label: "Contactado" },
  ignored: { icon: X, color: "text-gray-400", label: "Ignorado" },
  completed: { icon: CheckCircle, color: "text-green-600", label: "Completado" },
  expired: { icon: AlertCircle, color: "text-red-400", label: "Expirado" },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status;
  const query = params.q;
  const page = parseInt(params.page ?? "1", 10);
  const pageSize = 50;

  const supabase = await createClient();

  let dbQuery = supabase
    .from("predictions")
    .select(
      "id, vertical, prediction_date, message_text, confidence_score, priority, status, contacted_at, customer:customers!inner(name)",
      { count: "exact" }
    )
    .order("prediction_date", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (statusFilter && statusFilter !== "all") {
    dbQuery = dbQuery.eq("status", statusFilter);
  }

  if (query) {
    dbQuery = dbQuery.ilike("customer.name", `%${query}%`);
  }

  const { data: predictions, count, error } = await dbQuery;

  const totalPages = Math.ceil((count ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Historial</h1>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {statusFilter && (
            <input type="hidden" name="status" value={statusFilter} />
          )}
        </form>
        <div className="flex gap-1">
          {[
            { value: "all", label: "Todos" },
            { value: "pending", label: "Pendientes" },
            { value: "contacted", label: "Contactados" },
            { value: "ignored", label: "Ignorados" },
          ].map((opt) => (
            <a
              key={opt.value}
              href={`/historial?status=${opt.value}${query ? `&q=${query}` : ""}`}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                (statusFilter ?? "all") === opt.value
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </a>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 bg-red-50 p-3 rounded-lg text-sm">
          Error: {error.message}
        </p>
      )}

      {/* Lista */}
      {predictions?.length === 0 ? (
        <p className="text-gray-400 text-center py-12">
          No hay predicciones con estos filtros
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {predictions?.map((p) => {
            const config = statusConfig[p.status] ?? statusConfig.pending;
            const StatusIcon = config.icon;
            const customer = p.customer as unknown as
              | { name: string }
              | { name: string }[];
            const customerName = Array.isArray(customer)
              ? customer[0]?.name
              : customer?.name;
            return (
              <div
                key={p.id}
                className="p-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon
                    className={`h-5 w-5 shrink-0 ${config.color}`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {customerName}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(p.prediction_date)} | {p.vertical}
                      {p.confidence_score !== null &&
                        ` | ${Math.round(p.confidence_score * 100)}%`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium shrink-0 ${config.color}`}
                >
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/historial?page=${page - 1}${statusFilter ? `&status=${statusFilter}` : ""}${query ? `&q=${query}` : ""}`}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Anterior
            </a>
          )}
          <span className="px-3 py-1.5 text-sm text-gray-500">
            {page} de {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/historial?page=${page + 1}${statusFilter ? `&status=${statusFilter}` : ""}${query ? `&q=${query}` : ""}`}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Siguiente
            </a>
          )}
        </div>
      )}
    </div>
  );
}
