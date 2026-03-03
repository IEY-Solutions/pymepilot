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
  RankingRow,
} from "../metricas-content";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#FFFFFF",
    padding: 40,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    color: "#111827",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 4,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 10,
    color: "#6b7280",
    width: "40%",
  },
  kpiValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
    width: "20%",
  },
  kpiDetail: {
    fontSize: 9,
    color: "#9ca3af",
    width: "40%",
    textAlign: "right",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: 6,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
  },
  colRank: { width: "8%", fontSize: 9, color: "#6b7280" },
  colName: { width: "32%", fontSize: 9, color: "#111827" },
  colRevenue: { width: "20%", fontSize: 9, textAlign: "right" },
  colOrders: { width: "12%", fontSize: 9, textAlign: "right" },
  colTicket: { width: "15%", fontSize: 9, textAlign: "right" },
  colDate: { width: "13%", fontSize: 9, textAlign: "right", color: "#6b7280" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
});

import { formatCurrency } from "@/lib/format";

interface PdfData {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  rankings: RankingRow[];
}

function ReportDocument({ data }: { data: PdfData }) {
  const lastRevenue = data.revenue[data.revenue.length - 1];
  const lastChurn = data.churn[data.churn.length - 1];
  const lastTicket = data.ticket[data.ticket.length - 1];
  const totalValue = data.value.reduce(
    (s, v) => s + Number(v.attributed_value),
    0
  );
  const totalConv = data.value.reduce(
    (s, v) => s + Number(v.predictions_converted),
    0
  );
  const top10 = data.rankings.slice(0, 10);

  return (
    <Document title="Reporte PymePilot" author="PymePilot">
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>Reporte PymePilot</Text>
        <Text style={styles.subtitle}>
          Generado el {new Date().toLocaleDateString("es-AR")} — Ultimos 6 meses
        </Text>

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Resumen ejecutivo</Text>

        {lastRevenue && (
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Facturacion recurrente</Text>
            <Text style={styles.kpiValue}>
              {Number(lastRevenue.recurring_pct).toFixed(0)}%
            </Text>
            <Text style={styles.kpiDetail}>
              ${Number(lastRevenue.recurring_revenue).toLocaleString("es-AR")}{" "}
              de ${Number(lastRevenue.total_revenue).toLocaleString("es-AR")}
            </Text>
          </View>
        )}

        {lastChurn && (
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Churn mensual</Text>
            <Text style={styles.kpiValue}>
              {Number(lastChurn.churn_rate).toFixed(1)}%
            </Text>
            <Text style={styles.kpiDetail}>
              {lastChurn.churned} de {lastChurn.active_prev} clientes
            </Text>
          </View>
        )}

        {lastTicket && (
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Ticket promedio</Text>
            <Text style={styles.kpiValue}>
              {formatCurrency(Number(lastTicket.avg_ticket))}
            </Text>
            <Text style={styles.kpiDetail}>
              Rec: {formatCurrency(Number(lastTicket.avg_ticket_recurring || 0))}{" "}
              / Nuevo: {formatCurrency(Number(lastTicket.avg_ticket_new || 0))}
            </Text>
          </View>
        )}

        <View style={styles.kpiRow}>
          <Text style={styles.kpiLabel}>Valor generado por PymePilot</Text>
          <Text style={styles.kpiValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.kpiDetail}>
            {totalConv} predicciones convertidas
          </Text>
        </View>

        {/* Top 10 clientes */}
        <Text style={styles.sectionTitle}>Top 10 clientes</Text>

        <View style={styles.tableHeader}>
          <Text style={[styles.colRank, { fontWeight: "bold" }]}>#</Text>
          <Text style={[styles.colName, { fontWeight: "bold" }]}>Cliente</Text>
          <Text style={[styles.colRevenue, { fontWeight: "bold" }]}>
            Facturac.
          </Text>
          <Text style={[styles.colOrders, { fontWeight: "bold" }]}>
            Compras
          </Text>
          <Text style={[styles.colTicket, { fontWeight: "bold" }]}>Ticket</Text>
          <Text style={[styles.colDate, { fontWeight: "bold" }]}>
            Ult. compra
          </Text>
        </View>

        {top10.map((c) => (
          <View key={c.customer_id} style={styles.tableRow}>
            <Text style={styles.colRank}>{c.ranking}</Text>
            <Text style={styles.colName}>{c.name}</Text>
            <Text style={styles.colRevenue}>
              {formatCurrency(Number(c.total_revenue))}
            </Text>
            <Text style={styles.colOrders}>{c.total_orders}</Text>
            <Text style={styles.colTicket}>
              {formatCurrency(Number(c.avg_ticket))}
            </Text>
            <Text style={styles.colDate}>
              {c.last_purchase
                ? new Date(c.last_purchase + "T12:00:00").toLocaleDateString(
                    "es-AR",
                    { day: "2-digit", month: "short" }
                  )
                : "—"}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Generado por PymePilot — pymepilot.cloud
        </Text>
      </Page>
    </Document>
  );
}

export async function exportToPdf(data: PdfData) {
  const blob = await pdf(<ReportDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pymepilot-reporte-${new Date().toISOString().split("T")[0]}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
