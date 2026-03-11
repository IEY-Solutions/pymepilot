import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// TIPOS
// ============================================================

interface DemandDetail {
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
// COLORES
// ============================================================

const IEY_BLUE = "04a9ff";
const IEY_BLUE_DARK = "0387cc";
const DARK = "1a2a2c";
const DETAIL_BG = "e6f4ff";
const ROW_ALT = "f7f8fa";
const BORDER_COLOR = "d1d5db";
const TEXT_MID = "6b7280";

// ============================================================
// HELPERS
// ============================================================

function formatDateAR(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function buildDetailText(d: DemandDetail): string {
  const parts: string[] = [];

  const count = Number(d.purchase_count);
  parts.push(
    `Compraste este articulo ${count} ${count === 1 ? "vez" : "veces"}.`
  );

  if (d.last_order_date) {
    parts.push(
      `Tu ultima compra fue el ${formatDateAR(d.last_order_date)} con ${d.last_quantity} unidades.`
    );
  }

  if (d.frequency_days) {
    parts.push(
      `Compras en promedio cada ${Math.round(Number(d.frequency_days))} dias.`
    );
  }

  return parts.join(" ");
}

const thinBorder: Partial<ExcelJS.Border> = {
  style: "thin",
  color: { argb: BORDER_COLOR },
};
const allBorders: Partial<ExcelJS.Borders> = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

// ============================================================
// EXPORT PRINCIPAL
// ============================================================

export async function exportProposal(
  customerId: string,
  customerName: string
): Promise<void> {
  // Consultar detalle de demanda
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_client_demand_detail", {
    p_customer_id: customerId,
  });

  if (error) {
    throw new Error(`Error al consultar demanda: ${error.message}`);
  }

  // Filtrar solo SKUs con 2+ compras (alta confianza)
  const items: DemandDetail[] = (data ?? []).filter(
    (d: DemandDetail) => Number(d.purchase_count) >= 2
  );

  if (items.length === 0) {
    throw new Error(
      "No hay suficientes datos de compras repetidas para generar una propuesta."
    );
  }

  // Crear workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "PymePilot";
  const ws = wb.addWorksheet("Propuesta", {
    properties: { defaultColWidth: 20 },
  });

  // Anchos de columna
  ws.columns = [
    { width: 18 },  // A: SKU
    { width: 42 },  // B: Articulo
    { width: 20 },  // C: Cantidad sugerida
    { width: 70 },  // D: Detalle
  ];

  // ===========================================================
  // FILA 1: Titulo — fondo teal, texto blanco, grande
  // ===========================================================
  ws.mergeCells("A1:D1");
  const titleRow = ws.getRow(1);
  titleRow.height = 40;
  const titleCell = ws.getCell("A1");
  titleCell.value = "Propuesta de reposicion segun tus ultimas ordenes";
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: IEY_BLUE },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // ===========================================================
  // FILA 2: Cliente + fecha — fondo oscuro, texto claro
  // ===========================================================
  ws.mergeCells("A2:B2");
  const infoRow = ws.getRow(2);
  infoRow.height = 28;

  const today = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const clientCell = ws.getCell("A2");
  clientCell.value = customerName;
  clientCell.font = { size: 12, bold: true, color: { argb: "FFFFFF" } };
  clientCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DARK },
  };
  clientCell.alignment = { vertical: "middle" };

  // Aplicar fondo oscuro a C2 y D2 tambien
  const dateCell = ws.getCell("D2");
  dateCell.value = today;
  dateCell.font = { size: 10, color: { argb: IEY_BLUE } };
  dateCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DARK },
  };
  dateCell.alignment = { vertical: "middle", horizontal: "right" };

  ws.getCell("C2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DARK },
  };

  // ===========================================================
  // FILA 3: Separador vacio
  // ===========================================================
  ws.getRow(3).height = 8;

  // ===========================================================
  // FILA 4: Headers de tabla — fondo oscuro, texto blanco
  // ===========================================================
  const headers = ["SKU", "Articulo", "Cantidad sugerida", "Por que te lo recomendamos"];
  const headerRow = ws.getRow(4);
  headerRow.height = 28;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { size: 10, bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: IEY_BLUE_DARK },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: i === 2 ? "center" : "left",
    };
    cell.border = allBorders;
  });

  // ===========================================================
  // FILAS DE DATOS
  // ===========================================================
  items.forEach((item, idx) => {
    const rowNum = 5 + idx;
    const row = ws.getRow(rowNum);
    row.height = 36;

    const isAlt = idx % 2 === 1;
    const bgColor = isAlt ? ROW_ALT : "FFFFFF";

    // A: SKU
    const skuCell = row.getCell(1);
    skuCell.value = item.product_sku || "—";
    skuCell.font = { size: 10, color: { argb: TEXT_MID } };
    skuCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    skuCell.alignment = { vertical: "middle" };
    skuCell.border = allBorders;

    // B: Articulo
    const nameCell = row.getCell(2);
    nameCell.value = item.product_name;
    nameCell.font = { size: 10, bold: true, color: { argb: DARK } };
    nameCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    nameCell.alignment = { vertical: "middle", wrapText: true };
    nameCell.border = allBorders;

    // C: Cantidad sugerida
    const qtyCell = row.getCell(3);
    qtyCell.value = Number(item.demand_estimate);
    qtyCell.font = { size: 12, bold: true, color: { argb: DARK } };
    qtyCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    qtyCell.alignment = { vertical: "middle", horizontal: "center" };
    qtyCell.border = allBorders;

    // D: Detalle — fondo teal suave
    const detailCell = row.getCell(4);
    detailCell.value = buildDetailText(item);
    detailCell.font = { size: 9, italic: true, color: { argb: IEY_BLUE_DARK } };
    detailCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: DETAIL_BG },
    };
    detailCell.alignment = { vertical: "middle", wrapText: true };
    detailCell.border = allBorders;
  });

  // ===========================================================
  // FILA TOTAL
  // ===========================================================
  const totalRowNum = 5 + items.length + 1; // +1 para separador
  ws.getRow(5 + items.length).height = 6; // separador

  const totalRow = ws.getRow(totalRowNum);
  totalRow.height = 32;

  ws.mergeCells(`A${totalRowNum}:B${totalRowNum}`);
  const totalLabelCell = totalRow.getCell(1);
  totalLabelCell.value = "TOTAL ESTIMADO";
  totalLabelCell.font = { size: 11, bold: true, color: { argb: "FFFFFF" } };
  totalLabelCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DARK },
  };
  totalLabelCell.alignment = { vertical: "middle", horizontal: "right" };
  totalLabelCell.border = allBorders;

  const firstDataRow = 5;
  const lastDataRow = 5 + items.length - 1;
  const totalValCell = totalRow.getCell(3);
  totalValCell.value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
  totalValCell.font = { size: 13, bold: true, color: { argb: "FFFFFF" } };
  totalValCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: IEY_BLUE },
  };
  totalValCell.alignment = { vertical: "middle", horizontal: "center" };
  totalValCell.border = allBorders;

  const totalDetailCell = totalRow.getCell(4);
  totalDetailCell.value = "";
  totalDetailCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: DARK },
  };
  totalDetailCell.border = allBorders;

  // ===========================================================
  // FOOTER: PymePilot discreto
  // ===========================================================
  const footerRowNum = totalRowNum + 2;
  const footerCell = ws.getCell(`D${footerRowNum}`);
  footerCell.value = "Generado por PymePilot — pymepilot.cloud";
  footerCell.font = { size: 8, italic: true, color: { argb: TEXT_MID } };
  footerCell.alignment = { horizontal: "right" };

  // ===========================================================
  // PROTECCION: solo columna C (cantidad) es editable
  // ===========================================================
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
  });

  // Desbloquear celdas de cantidad para que el cliente pueda editarlas
  for (let i = 0; i < items.length; i++) {
    const qtyCell = ws.getRow(firstDataRow + i).getCell(3);
    qtyCell.protection = { locked: false };
  }

  // ===========================================================
  // GENERAR Y DESCARGAR
  // ===========================================================
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const safeName = customerName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 40);

  const dateStr = new Date().toISOString().split("T")[0];
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `propuesta-reposicion-${safeName}-${dateStr}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
