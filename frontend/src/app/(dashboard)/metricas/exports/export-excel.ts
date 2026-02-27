import * as XLSX from "xlsx";
import type {
  RevenueRow,
  ChurnRow,
  TicketRow,
  ValueRow,
  RankingRow,
} from "../metricas-content";

interface ExportData {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  rankings: RankingRow[];
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function exportToExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const resumenData = [
    ["Reporte PymePilot", "", ""],
    ["Generado", new Date().toLocaleDateString("es-AR"), ""],
    ["Periodo", "Ultimos 6 meses", ""],
    ["", "", ""],
    ["KPI", "Valor", "Detalle"],
  ];

  const lastRevenue = data.revenue[data.revenue.length - 1];
  if (lastRevenue) {
    resumenData.push([
      "% Recurrente",
      `${Number(lastRevenue.recurring_pct).toFixed(1)}%`,
      `$${Number(lastRevenue.recurring_revenue).toLocaleString("es-AR")} de $${Number(lastRevenue.total_revenue).toLocaleString("es-AR")}`,
    ]);
  }

  const lastChurn = data.churn[data.churn.length - 1];
  if (lastChurn) {
    resumenData.push([
      "Churn",
      `${Number(lastChurn.churn_rate).toFixed(1)}%`,
      `${lastChurn.churned} de ${lastChurn.active_prev} clientes`,
    ]);
  }

  const lastTicket = data.ticket[data.ticket.length - 1];
  if (lastTicket) {
    resumenData.push([
      "Ticket promedio",
      `$${Number(lastTicket.avg_ticket).toLocaleString("es-AR")}`,
      `Rec: $${Number(lastTicket.avg_ticket_recurring || 0).toLocaleString("es-AR")} / Nuevo: $${Number(lastTicket.avg_ticket_new || 0).toLocaleString("es-AR")}`,
    ]);
  }

  const totalValue = data.value.reduce(
    (s, v) => s + Number(v.attributed_value),
    0
  );
  const totalConv = data.value.reduce(
    (s, v) => s + Number(v.predictions_converted),
    0
  );
  resumenData.push([
    "Valor PymePilot",
    `$${totalValue.toLocaleString("es-AR")}`,
    `${totalConv} conversiones`,
  ]);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Hoja 2: Facturacion Mensual
  const factRows = data.revenue.map((r) => ({
    Mes: formatMonth(r.month),
    Total: Number(r.total_revenue),
    Recurrente: Number(r.recurring_revenue),
    Nueva: Number(r.new_revenue),
    "% Recurrente": Number(r.recurring_pct),
  }));
  const wsFact = XLSX.utils.json_to_sheet(factRows);
  wsFact["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];
  XLSX.utils.book_append_sheet(wb, wsFact, "Facturacion");

  // Hoja 3: Churn + Ticket
  const metricsRows = data.churn.map((c, i) => {
    const t = data.ticket[i];
    return {
      Mes: formatMonth(c.month),
      "Activos mes ant.": c.active_prev,
      Churned: c.churned,
      "Churn %": Number(c.churn_rate),
      "Ticket prom.": t ? Number(t.avg_ticket) : "",
      "Ticket rec.": t ? Number(t.avg_ticket_recurring || 0) : "",
      "Ticket nuevo": t ? Number(t.avg_ticket_new || 0) : "",
    };
  });
  const wsMetrics = XLSX.utils.json_to_sheet(metricsRows);
  XLSX.utils.book_append_sheet(wb, wsMetrics, "Metricas");

  // Hoja 4: Clientes
  const trendLabel: Record<string, string> = {
    up: "Sube",
    down: "Baja",
    stable: "Estable",
  };
  const clientRows = data.rankings.map((c) => ({
    "#": c.ranking,
    Cliente: c.name,
    Tendencia: trendLabel[c.trend] ?? "Estable",
    Facturacion: Number(c.total_revenue),
    Compras: c.total_orders,
    "Ticket prom.": Number(c.avg_ticket),
    "Ult. compra": c.last_purchase,
    "Freq. (dias)": c.avg_days_between_purchases
      ? Math.round(Number(c.avg_days_between_purchases))
      : "",
  }));
  const wsClients = XLSX.utils.json_to_sheet(clientRows);
  wsClients["!cols"] = [
    { wch: 5 },
    { wch: 30 },
    { wch: 10 },
    { wch: 15 },
    { wch: 10 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsClients, "Clientes");

  // Descargar
  XLSX.writeFile(
    wb,
    `pymepilot-reporte-${new Date().toISOString().split("T")[0]}.xlsx`
  );
}
