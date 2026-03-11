import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type {
  RevenueRow,
  ChurnRow,
  TicketRow,
  ValueRow,
  SalesRow,
  RankingRow,
} from "../metricas-content";
import type { ProductRankingRow } from "../product-ranking-table";
import type { DemandProjectionRow } from "../demand-projection-table";
import type { ClientDemandRow } from "../client-demand-table";
import { formatCurrency } from "@/lib/format";

// ============================================================
// PALETA PYMEPILOT
// ============================================================

const C = {
  dark: "#1a2a2c",
  teal: "#81b5a1",
  tealDark: "#5a9a84",
  white: "#ffffff",
  lightGray: "#f7f8fa",
  midGray: "#e5e7eb",
  textDark: "#1f2937",
  textMid: "#6b7280",
  textLight: "#9ca3af",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
};

// ============================================================
// ESTILOS
// ============================================================

const s = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 50,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
  },
  // Header
  header: {
    backgroundColor: C.dark,
    paddingHorizontal: 32,
    paddingVertical: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: C.teal,
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 9,
    color: C.white,
    opacity: 0.6,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerDate: {
    fontSize: 9,
    color: C.white,
    opacity: 0.7,
  },
  headerPeriod: {
    fontSize: 8,
    color: C.teal,
    marginTop: 2,
  },
  // Body
  body: {
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  // KPI strip
  kpiStrip: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: C.lightGray,
    borderRadius: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.teal,
  },
  kpiLabel: {
    fontSize: 7,
    color: C.textMid,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: C.textDark,
  },
  kpiDetail: {
    fontSize: 7,
    color: C.textLight,
    marginTop: 2,
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.dark,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 2,
    borderBottomColor: C.teal,
  },
  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.dark,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderText: {
    fontSize: 7,
    fontWeight: "bold",
    color: C.white,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.midGray,
  },
  tableRowAlt: {
    backgroundColor: C.lightGray,
  },
  cellText: {
    fontSize: 8,
    color: C.textDark,
  },
  cellTextMuted: {
    fontSize: 8,
    color: C.textMid,
  },
  cellTextRight: {
    fontSize: 8,
    color: C.textDark,
    textAlign: "right" as const,
  },
  cellTextBold: {
    fontSize: 8,
    fontWeight: "bold",
    color: C.textDark,
    textAlign: "right" as const,
  },
  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.midGray,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: C.textLight,
  },
  footerBrand: {
    fontSize: 7,
    color: C.teal,
    fontWeight: "bold",
  },
  // Trend indicator
  trendUp: { color: C.green },
  trendDown: { color: C.red },
  trendStable: { color: C.textLight },
  // Rubro header
  rubroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.lightGray,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.tealDark,
  },
  rubroTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: C.dark,
  },
  rubroDemand: {
    fontSize: 8,
    color: C.tealDark,
    fontWeight: "bold",
  },
});

// ============================================================
// TIPOS
// ============================================================

export interface PdfData {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  sales: SalesRow[];
  rankings: RankingRow[];
  productRankings: ProductRankingRow[];
  demandProjections: DemandProjectionRow[];
  clientDemand: ClientDemandRow[];
}

// ============================================================
// HELPERS
// ============================================================

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function trendArrow(val: number): string {
  if (val > 0) return `+${val.toFixed(1)}%`;
  if (val < 0) return `${val.toFixed(1)}%`;
  return "0%";
}

// ============================================================
// DOCUMENTO
// ============================================================

function ReportDocument({ data }: { data: PdfData }) {
  const lastRevenue = data.revenue[data.revenue.length - 1];
  const lastChurn = data.churn[data.churn.length - 1];
  const lastTicket = data.ticket[data.ticket.length - 1];
  const lastSales = data.sales[data.sales.length - 1];
  const totalValue = data.value.reduce(
    (sum, v) => sum + Number(v.attributed_value),
    0
  );
  const totalConv = data.value.reduce(
    (sum, v) => sum + Number(v.predictions_converted),
    0
  );
  const top20 = data.rankings.slice(0, 20);
  const top15products = data.productRankings.slice(0, 15);
  const totalDemand = data.demandProjections.reduce(
    (sum, p) => sum + Number(p.projected_demand_30d),
    0
  );

  // Agrupar demanda por rubro
  const rubroMap = new Map<string, DemandProjectionRow[]>();
  for (const p of data.demandProjections) {
    const rubro = p.product_rubro || "Otros";
    if (!rubroMap.has(rubro)) rubroMap.set(rubro, []);
    rubroMap.get(rubro)!.push(p);
  }
  const rubros = Array.from(rubroMap.entries())
    .map(([rubro, products]) => ({
      rubro,
      products: products.slice(0, 5), // Top 5 por rubro
      totalDemand: products.reduce((s, p) => s + Number(p.projected_demand_30d), 0),
    }))
    .sort((a, b) => b.totalDemand - a.totalDemand);

  const months = data.revenue.length;
  const periodLabel = `Ultimos ${months} meses`;

  return (
    <Document title="Reporte PymePilot" author="PymePilot">
      {/* ============ PAGINA 1: KPIs + Facturacion + Churn/Ticket ============ */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>PYMEPILOT</Text>
            <Text style={s.headerSub}>Reporte de metricas</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>
              {new Date().toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </Text>
            <Text style={s.headerPeriod}>{periodLabel}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* KPIs */}
          <View style={s.kpiStrip}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Ventas del mes</Text>
              <Text style={s.kpiValue}>
                {lastSales ? Number(lastSales.total_orders) : "—"}
              </Text>
              <Text style={s.kpiDetail}>
                {lastSales ? formatCurrency(Number(lastSales.total_revenue)) : ""}
              </Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>% Recurrente</Text>
              <Text style={s.kpiValue}>
                {lastRevenue ? `${Number(lastRevenue.recurring_pct).toFixed(0)}%` : "—"}
              </Text>
              <Text style={s.kpiDetail}>
                {lastRevenue
                  ? `${formatCurrency(Number(lastRevenue.recurring_revenue))} rec.`
                  : ""}
              </Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Churn</Text>
              <Text style={s.kpiValue}>
                {lastChurn ? `${Number(lastChurn.churn_rate).toFixed(1)}%` : "—"}
              </Text>
              <Text style={s.kpiDetail}>
                {lastChurn ? `${lastChurn.churned} de ${lastChurn.active_prev}` : ""}
              </Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Ticket prom.</Text>
              <Text style={s.kpiValue}>
                {lastTicket ? formatCurrency(Number(lastTicket.avg_ticket)) : "—"}
              </Text>
              <Text style={s.kpiDetail}>
                {lastTicket
                  ? `Rec: ${formatCurrency(Number(lastTicket.avg_ticket_recurring || 0))}`
                  : ""}
              </Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Valor PymePilot</Text>
              <Text style={s.kpiValue}>{formatCurrency(totalValue)}</Text>
              <Text style={s.kpiDetail}>{totalConv} conversiones</Text>
            </View>
          </View>

          {/* Facturacion mensual */}
          <Text style={s.sectionTitle}>Facturacion mensual</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: "18%" }]}>Mes</Text>
            <Text style={[s.tableHeaderText, { width: "22%", textAlign: "right" }]}>Total</Text>
            <Text style={[s.tableHeaderText, { width: "22%", textAlign: "right" }]}>Recurrente</Text>
            <Text style={[s.tableHeaderText, { width: "22%", textAlign: "right" }]}>Nueva</Text>
            <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>% Rec.</Text>
          </View>
          {data.revenue.map((r, i) => (
            <View key={r.month} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cellText, { width: "18%" }]}>{formatMonth(r.month)}</Text>
              <Text style={[s.cellTextBold, { width: "22%" }]}>
                {formatCurrency(Number(r.total_revenue))}
              </Text>
              <Text style={[s.cellTextRight, { width: "22%" }]}>
                {formatCurrency(Number(r.recurring_revenue))}
              </Text>
              <Text style={[s.cellTextRight, { width: "22%" }]}>
                {formatCurrency(Number(r.new_revenue))}
              </Text>
              <Text style={[s.cellTextRight, { width: "16%" }]}>
                {Number(r.recurring_pct).toFixed(0)}%
              </Text>
            </View>
          ))}

          {/* Churn + Ticket */}
          <Text style={s.sectionTitle}>Churn y ticket promedio</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: "16%" }]}>Mes</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>Activos</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>Churned</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>Churn %</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>Ticket</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>T. Rec.</Text>
            <Text style={[s.tableHeaderText, { width: "14%", textAlign: "right" }]}>T. Nuevo</Text>
          </View>
          {data.churn.map((c, i) => {
            const t = data.ticket[i];
            return (
              <View key={c.month} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                <Text style={[s.cellText, { width: "16%" }]}>{formatMonth(c.month)}</Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>{c.active_prev}</Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>{c.churned}</Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>
                  {Number(c.churn_rate).toFixed(1)}%
                </Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>
                  {t ? formatCurrency(Number(t.avg_ticket)) : "—"}
                </Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>
                  {t ? formatCurrency(Number(t.avg_ticket_recurring || 0)) : "—"}
                </Text>
                <Text style={[s.cellTextRight, { width: "14%" }]}>
                  {t ? formatCurrency(Number(t.avg_ticket_new || 0)) : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerBrand}>PYMEPILOT</Text>
          <Text style={s.footerText}>pymepilot.cloud</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ============ PAGINA 2: Top clientes + Productos ============ */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>PYMEPILOT</Text>
            <Text style={s.headerSub}>Clientes y productos</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Top 20 clientes */}
          <Text style={s.sectionTitle}>Top 20 clientes por facturacion</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: "6%" }]}>#</Text>
            <Text style={[s.tableHeaderText, { width: "28%" }]}>Cliente</Text>
            <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>Facturac.</Text>
            <Text style={[s.tableHeaderText, { width: "10%", textAlign: "right" }]}>Compras</Text>
            <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>Ticket</Text>
            <Text style={[s.tableHeaderText, { width: "12%", textAlign: "right" }]}>Ult. compra</Text>
            <Text style={[s.tableHeaderText, { width: "12%", textAlign: "center" }]}>Tendencia</Text>
          </View>
          {top20.map((c, i) => (
            <View key={c.customer_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cellTextMuted, { width: "6%" }]}>{c.ranking}</Text>
              <Text style={[s.cellText, { width: "28%" }]}>{c.name}</Text>
              <Text style={[s.cellTextBold, { width: "16%" }]}>
                {formatCurrency(Number(c.total_revenue))}
              </Text>
              <Text style={[s.cellTextRight, { width: "10%" }]}>{c.total_orders}</Text>
              <Text style={[s.cellTextRight, { width: "16%" }]}>
                {formatCurrency(Number(c.avg_ticket))}
              </Text>
              <Text style={[s.cellTextRight, { width: "12%" }]}>
                {c.last_purchase
                  ? new Date(c.last_purchase + "T12:00:00").toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "short",
                    })
                  : "—"}
              </Text>
              <Text
                style={[
                  { width: "12%", textAlign: "center", fontSize: 8 },
                  c.trend === "up" ? s.trendUp : c.trend === "down" ? s.trendDown : s.trendStable,
                ]}
              >
                {c.trend === "up" ? "▲ Sube" : c.trend === "down" ? "▼ Baja" : "— Estable"}
              </Text>
            </View>
          ))}

          {/* Top 15 productos */}
          <Text style={s.sectionTitle}>Top 15 productos por unidades</Text>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: "6%" }]}>#</Text>
            <Text style={[s.tableHeaderText, { width: "40%" }]}>Producto</Text>
            <Text style={[s.tableHeaderText, { width: "14%" }]}>SKU</Text>
            <Text style={[s.tableHeaderText, { width: "20%", textAlign: "right" }]}>Unidades</Text>
            <Text style={[s.tableHeaderText, { width: "20%", textAlign: "right" }]}>Facturac.</Text>
          </View>
          {top15products.map((p, i) => (
            <View key={p.product_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.cellTextMuted, { width: "6%" }]}>{i + 1}</Text>
              <Text style={[s.cellText, { width: "40%" }]}>{p.product_name || "Producto sin nombre"}</Text>
              <Text style={[s.cellTextMuted, { width: "14%" }]}>{p.product_sku || "—"}</Text>
              <Text style={[s.cellTextBold, { width: "20%" }]}>
                {Number(p.total_units).toLocaleString("es-AR")}
              </Text>
              <Text style={[s.cellTextRight, { width: "20%" }]}>
                {formatCurrency(Number(p.total_revenue))}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerBrand}>PYMEPILOT</Text>
          <Text style={s.footerText}>pymepilot.cloud</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ============ PAGINA 3: Demanda proyectada ============ */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>PYMEPILOT</Text>
            <Text style={s.headerSub}>Demanda proyectada — proximos 30 dias</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={[s.headerDate, { fontSize: 12, fontWeight: "bold" }]}>
              {totalDemand.toLocaleString("es-AR")} uds
            </Text>
            <Text style={s.headerPeriod}>demanda total estimada</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* Por rubro */}
          <Text style={s.sectionTitle}>Demanda por categoria</Text>

          {rubros.map((rubro) => (
            <View key={rubro.rubro} wrap={false}>
              <View style={s.rubroHeader}>
                <Text style={s.rubroTitle}>
                  {rubro.rubro} ({rubro.products.length} prod.)
                </Text>
                <Text style={s.rubroDemand}>
                  {rubro.totalDemand.toLocaleString("es-AR")} uds
                </Text>
              </View>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { width: "36%" }]}>Producto</Text>
                <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>
                  Demanda 30d
                </Text>
                <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>
                  Venta mensual
                </Text>
                <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>
                  Tendencia
                </Text>
                <Text style={[s.tableHeaderText, { width: "16%", textAlign: "right" }]}>
                  Clientes
                </Text>
              </View>
              {rubro.products.map((p, i) => {
                const trend = Number(p.trend_pct);
                return (
                  <View key={p.product_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                    <Text style={[s.cellText, { width: "36%" }]}>{p.product_name || "Producto sin nombre"}</Text>
                    <Text style={[s.cellTextBold, { width: "16%" }]}>
                      {Number(p.projected_demand_30d).toLocaleString("es-AR")}
                    </Text>
                    <Text style={[s.cellTextRight, { width: "16%" }]}>
                      {Number(p.avg_monthly_units).toLocaleString("es-AR")}
                    </Text>
                    <Text
                      style={[
                        { width: "16%", textAlign: "right", fontSize: 8 },
                        trend > 5 ? s.trendUp : trend < -5 ? s.trendDown : s.trendStable,
                      ]}
                    >
                      {trendArrow(trend)}
                    </Text>
                    <Text style={[s.cellTextRight, { width: "16%" }]}>
                      {Number(p.unique_customers)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Top clientes por demanda */}
          {data.clientDemand.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Top clientes por facturacion (6 meses)</Text>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderText, { width: "6%" }]}>#</Text>
                <Text style={[s.tableHeaderText, { width: "28%" }]}>Cliente</Text>
                <Text style={[s.tableHeaderText, { width: "18%", textAlign: "right" }]}>
                  Facturac.
                </Text>
                <Text style={[s.tableHeaderText, { width: "12%", textAlign: "right" }]}>
                  Pedidos
                </Text>
                <Text style={[s.tableHeaderText, { width: "18%", textAlign: "right" }]}>
                  Ticket prom.
                </Text>
                <Text style={[s.tableHeaderText, { width: "18%", textAlign: "right" }]}>
                  Vuelve aprox.
                </Text>
              </View>
              {data.clientDemand.map((c, i) => (
                <View key={c.customer_id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
                  <Text style={[s.cellTextMuted, { width: "6%" }]}>{i + 1}</Text>
                  <Text style={[s.cellText, { width: "28%" }]}>{c.customer_name || "Cliente sin nombre"}</Text>
                  <Text style={[s.cellTextBold, { width: "18%" }]}>
                    {formatCurrency(Number(c.total_revenue))}
                  </Text>
                  <Text style={[s.cellTextRight, { width: "12%" }]}>
                    {Number(c.total_orders)}
                  </Text>
                  <Text style={[s.cellTextRight, { width: "18%" }]}>
                    {formatCurrency(Number(c.avg_ticket))}
                  </Text>
                  <Text style={[s.cellTextRight, { width: "18%" }]}>
                    {formatDate(c.next_purchase_estimate)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerBrand}>PYMEPILOT</Text>
          <Text style={s.footerText}>pymepilot.cloud</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ============================================================
// EXPORT FUNCTION
// ============================================================

export async function exportToPdf(data: PdfData) {
  const blob = await pdf(<ReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pymepilot-reporte-${new Date().toISOString().split("T")[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
