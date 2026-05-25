import ExcelJS from "exceljs";
import type {
  RevenueRow,
  ChurnRow,
  TicketRow,
  ValueRow,
  RankingRow,
} from "../metricas-content";
import { formatMonthLong } from "@/lib/format";

interface ExportData {
  revenue: RevenueRow[];
  churn: ChurnRow[];
  ticket: TicketRow[];
  value: ValueRow[];
  rankings: RankingRow[];
}

function downloadWorkbook(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setColumnWidths(worksheet: ExcelJS.Worksheet, widths: number[]) {
  worksheet.columns = widths.map((width) => ({ width }));
}

export async function exportToExcel(data: ExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "PymePilot";
  wb.created = new Date();

  const wsResumen = wb.addWorksheet("Resumen");
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

  wsResumen.addRows(resumenData);
  setColumnWidths(wsResumen, [20, 20, 40]);

  const wsFact = wb.addWorksheet("Facturacion");
  wsFact.columns = [
    { header: "Mes", key: "month", width: 20 },
    { header: "Total", key: "total", width: 15 },
    { header: "Recurrente", key: "recurring", width: 15 },
    { header: "Nueva", key: "new", width: 15 },
    { header: "% Recurrente", key: "recurringPct", width: 15 },
  ];
  const factRows = data.revenue.map((r) => ({
    month: formatMonthLong(r.month),
    total: Number(r.total_revenue),
    recurring: Number(r.recurring_revenue),
    new: Number(r.new_revenue),
    recurringPct: Number(r.recurring_pct),
  }));
  wsFact.addRows(factRows);

  const wsMetrics = wb.addWorksheet("Metricas");
  wsMetrics.columns = [
    { header: "Mes", key: "month", width: 20 },
    { header: "Activos mes ant.", key: "activePrev", width: 18 },
    { header: "Churned", key: "churned", width: 12 },
    { header: "Churn %", key: "churnRate", width: 12 },
    { header: "Ticket prom.", key: "avgTicket", width: 15 },
    { header: "Ticket rec.", key: "recurringTicket", width: 15 },
    { header: "Ticket nuevo", key: "newTicket", width: 15 },
  ];
  const metricsRows = data.churn.map((c, i) => {
    const t = data.ticket[i];
    return {
      month: formatMonthLong(c.month),
      activePrev: c.active_prev,
      churned: c.churned,
      churnRate: Number(c.churn_rate),
      avgTicket: t ? Number(t.avg_ticket) : "",
      recurringTicket: t ? Number(t.avg_ticket_recurring || 0) : "",
      newTicket: t ? Number(t.avg_ticket_new || 0) : "",
    };
  });
  wsMetrics.addRows(metricsRows);

  const wsClients = wb.addWorksheet("Clientes");
  wsClients.columns = [
    { header: "#", key: "ranking", width: 5 },
    { header: "Cliente", key: "client", width: 30 },
    { header: "Tendencia", key: "trend", width: 10 },
    { header: "Facturacion", key: "revenue", width: 15 },
    { header: "Compras", key: "orders", width: 10 },
    { header: "Ticket prom.", key: "avgTicket", width: 15 },
    { header: "Ult. compra", key: "lastPurchase", width: 12 },
    { header: "Freq. (dias)", key: "frequencyDays", width: 12 },
  ];
  const trendLabel: Record<string, string> = {
    up: "Sube",
    down: "Baja",
    stable: "Estable",
  };
  const clientRows = data.rankings.map((c) => ({
    ranking: c.ranking,
    client: c.name,
    trend: trendLabel[c.trend] ?? "Estable",
    revenue: Number(c.total_revenue),
    orders: c.total_orders,
    avgTicket: Number(c.avg_ticket),
    lastPurchase: c.last_purchase,
    frequencyDays: c.avg_days_between_purchases
      ? Math.round(Number(c.avg_days_between_purchases))
      : "",
  }));
  wsClients.addRows(clientRows);

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbook(
    buffer,
    `pymepilot-reporte-${new Date().toISOString().split("T")[0]}.xlsx`
  );
}
