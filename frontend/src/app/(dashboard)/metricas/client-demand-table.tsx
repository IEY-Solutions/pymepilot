"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Package, Users } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// TIPOS
// ============================================================

export interface ClientDemandRow {
  customer_id: string;
  customer_name: string;
  total_revenue: number;
  total_orders: number;
  avg_ticket: number;
  frequency_days: number | null;
  last_order_date: string;
  next_purchase_estimate: string | null;
}

interface ClientDetailRow {
  product_id: string;
  product_name: string;
  product_sku: string;
  last_order_date: string;
  last_quantity: number;
  avg_quantity: number;
  frequency_days: number | null;
  next_purchase_estimate: string | null;
  demand_estimate: number;
  purchase_count: number;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function ClientDemandTable({
  clients,
}: {
  clients: ClientDemandRow[];
}) {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ClientDetailRow[]>>({});
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

  async function toggleExpand(customerId: string) {
    if (expandedClient === customerId) {
      setExpandedClient(null);
      return;
    }

    setExpandedClient(customerId);

    if (!details[customerId]) {
      setLoadingDetail(customerId);
      const supabase = createClient();
      const { data } = await supabase.rpc("get_client_demand_detail", {
        p_customer_id: customerId,
      });
      setDetails((prev) => ({ ...prev, [customerId]: data ?? [] }));
      setLoadingDetail(null);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  }

  function isOverdue(dateStr: string | null) {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  if (clients.length === 0) {
    return (
      <div className="glass-dark rounded-2xl p-8 text-center">
        <Users className="h-12 w-12 mx-auto text-white/20 mb-3" />
        <p className="text-white/50 text-sm">
          Sin datos de clientes aun. Se calculara automaticamente cuando haya ordenes sincronizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a2a2c] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          Top {clients.length} clientes por facturacion
          <InfoTooltip text="Clientes ordenados por facturacion en los ultimos 6 meses. Expandi cada uno para ver su proximo pedido estimado basado en sus patrones de compra." />
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-4 py-2.5 w-8">#</th>
              <th className="text-left px-4 py-2.5">Cliente</th>
              <th className="text-right px-4 py-2.5">Compras (6 meses)</th>
              <th className="text-right px-4 py-2.5 hidden sm:table-cell">Pedidos</th>
              <th className="text-right px-4 py-2.5 hidden md:table-cell">Promedio por pedido</th>
              <th className="text-right px-4 py-2.5 hidden md:table-cell">Compra cada</th>
              <th className="text-right px-4 py-2.5 hidden lg:table-cell">Vuelve aprox.</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, i) => (
              <ClientRow
                key={client.customer_id}
                client={client}
                rank={i + 1}
                isExpanded={expandedClient === client.customer_id}
                isLoading={loadingDetail === client.customer_id}
                detail={details[client.customer_id]}
                onToggle={() => toggleExpand(client.customer_id)}
                formatDate={formatDate}
                isOverdue={isOverdue}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// FILA DE CLIENTE (expandible con 3 bloques)
// ============================================================

function ClientRow({
  client,
  rank,
  isExpanded,
  isLoading,
  detail,
  onToggle,
  formatDate,
  isOverdue,
}: {
  client: ClientDemandRow;
  rank: number;
  isExpanded: boolean;
  isLoading: boolean;
  detail?: ClientDetailRow[];
  onToggle: () => void;
  formatDate: (d: string | null) => string;
  isOverdue: (d: string | null) => boolean;
}) {
  const [showAlsoBought, setShowAlsoBought] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const overdue = isOverdue(client.next_purchase_estimate);

  // Separar SKUs por confianza
  const highConfidence = detail?.filter((d) => Number(d.purchase_count) >= 2) ?? [];
  const lowConfidence = detail?.filter((d) => Number(d.purchase_count) < 2) ?? [];
  const totalEstimated = highConfidence.reduce(
    (sum, d) => sum + Number(d.demand_estimate),
    0
  );

  return (
    <>
      <tr
        className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-white/30 text-xs">{rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
            )}
            <p className="text-sm text-white font-medium truncate max-w-[200px]">
              {client.customer_name}
            </p>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-sm font-semibold text-white">
            {formatCurrency(Number(client.total_revenue))}
          </span>
        </td>
        <td className="px-4 py-3 text-right hidden sm:table-cell">
          <span className="text-sm text-white/60">{Number(client.total_orders)}</span>
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className="text-sm text-white/60">
            {formatCurrency(Number(client.avg_ticket))}
          </span>
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <span className="text-sm text-white/60">
            {client.frequency_days ? `${Number(client.frequency_days)} dias` : "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-right hidden lg:table-cell">
          <span className={`text-sm ${overdue ? "text-amber-400" : "text-white/40"}`}>
            {formatDate(client.next_purchase_estimate)}
          </span>
        </td>
      </tr>

      {/* Detalle expandido */}
      {isExpanded && (
        <tr>
          <td colSpan={7} className="bg-white/[0.02] px-4 py-4">
            {isLoading ? (
              <p className="text-xs text-white/30 text-center py-4">Cargando analisis...</p>
            ) : !detail || detail.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">Sin datos suficientes para analizar</p>
            ) : (
              <div className="space-y-4">
                {/* BLOQUE 1: Proximo pedido estimado (3+ compras) */}
                {highConfidence.length > 0 ? (
                  <div className="glass-green rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-4 w-4 text-teal-400" />
                      <h4 className="text-sm font-semibold text-white">
                        Proximo pedido estimado
                        {client.next_purchase_estimate && (
                          <span className={`ml-2 font-normal ${overdue ? "text-amber-400" : "text-white/40"}`}>
                            — vuelve aprox. {formatDate(client.next_purchase_estimate)}
                          </span>
                        )}
                      </h4>
                    </div>

                    <div className="space-y-1.5">
                      {highConfidence.map((d) => (
                        <div
                          key={d.product_id}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-sm font-semibold text-white w-14 text-right flex-shrink-0">
                              {Number(d.demand_estimate)} uds
                            </span>
                            <span className="text-sm text-white/70 truncate">
                              {d.product_name}
                            </span>
                          </div>
                          <span className="text-[10px] text-white/30 flex-shrink-0 ml-2">
                            compra cada {Number(d.frequency_days)}d · {Number(d.purchase_count)} pedidos
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/[0.06] flex justify-between items-center">
                      <span className="text-xs text-white/40">Total estimado</span>
                      <span className="text-sm font-bold text-white">~{totalEstimated} unidades</span>
                    </div>
                  </div>
                ) : (
                  <div className="glass-dark rounded-xl p-4 text-center">
                    <p className="text-xs text-white/40">
                      Sin suficientes compras repetidas para proyectar el proximo pedido.
                      Se necesitan al menos 2 compras del mismo producto.
                    </p>
                  </div>
                )}

                {/* BLOQUE 2: Tambien compro (1-2 compras, colapsable) */}
                {lowConfidence.length > 0 && (
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAlsoBought(!showAlsoBought);
                      }}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      {showAlsoBought ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Tambien compro ({lowConfidence.length} productos sin patron repetitivo)
                    </button>

                    {showAlsoBought && (
                      <div className="mt-2 pl-4 space-y-1">
                        {lowConfidence.map((d) => (
                          <div
                            key={d.product_id}
                            className="flex items-center gap-3 py-0.5 text-xs text-white/35"
                          >
                            <span className="w-14 text-right flex-shrink-0">
                              {d.last_quantity} uds
                            </span>
                            <span className="truncate">{d.product_name}</span>
                            <span className="flex-shrink-0">
                              ({Number(d.purchase_count)} {Number(d.purchase_count) === 1 ? "compra" : "compras"}, ult. {formatDate(d.last_order_date)})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* BLOQUE 3: Historial completo (colapsable) */}
                {detail.length > 0 && (
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFullHistory(!showFullHistory);
                      }}
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                    >
                      {showFullHistory ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      Ver historial completo ({detail.length} productos)
                    </button>

                    {showFullHistory && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-white/30 text-[10px] uppercase tracking-wider">
                              <th className="text-left px-3 py-1.5">Producto</th>
                              <th className="text-right px-3 py-1.5">Ultimo pedido</th>
                              <th className="text-right px-3 py-1.5">Pide en promedio</th>
                              <th className="text-right px-3 py-1.5 hidden sm:table-cell">Compra cada</th>
                              <th className="text-right px-3 py-1.5 hidden sm:table-cell">Vuelve aprox.</th>
                              <th className="text-right px-3 py-1.5">Pedidos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.map((d) => (
                              <tr key={d.product_id} className="border-t border-white/[0.03]">
                                <td className="px-3 py-1.5 text-xs text-white/60 truncate max-w-[200px]">
                                  {d.product_name}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-white/40 text-right">
                                  {d.last_quantity} uds ({formatDate(d.last_order_date)})
                                </td>
                                <td className="px-3 py-1.5 text-xs text-white/50 text-right">
                                  {Number(d.avg_quantity)} uds
                                </td>
                                <td className="px-3 py-1.5 text-xs text-white/40 text-right hidden sm:table-cell">
                                  {d.frequency_days ? `${Number(d.frequency_days)} dias` : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-right hidden sm:table-cell">
                                  <span className={isOverdue(d.next_purchase_estimate) ? "text-amber-400" : "text-white/40"}>
                                    {formatDate(d.next_purchase_estimate)}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-xs text-white/40 text-right">
                                  {Number(d.purchase_count)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
