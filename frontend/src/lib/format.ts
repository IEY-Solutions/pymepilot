/**
 * Formatea un numero como moneda compacta ($1.5M, $50k, $123).
 * Centralizado para evitar 7 copias con variaciones.
 * Maneja negativos, NaN e Infinity de forma segura.
 */
export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Formatea un string de fecha ("YYYY-MM-DD" o "YYYY-MM") como mes corto en español.
 * Ejemplo: "2026-03-01" → "mar"
 *
 * Usado en graficos de metricas donde el eje X muestra meses compactos.
 * El sufijo "T12:00:00" evita problemas de timezone donde el dia 1 a medianoche
 * se interpreta como el mes anterior segun el timezone del browser.
 *
 * M-10: Centralizado desde 4 copias en metricas/charts/*.tsx
 */
export function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
}

/**
 * Formatea un string de fecha como mes corto + año en 2 digitos en español.
 * Ejemplo: "2026-03-01" → "mar. 26"
 *
 * Usado en exportaciones PDF donde el espacio es limitado.
 *
 * M-10: Centralizado desde export-pdf.tsx
 */
export function formatMonthShortYear(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
}

/**
 * Formatea un string de fecha como mes largo + año en español.
 * Ejemplo: "2026-03-01" → "marzo de 2026"
 *
 * Usado en exportaciones Excel donde hay espacio suficiente.
 *
 * M-10: Centralizado desde export-excel.ts
 */
export function formatMonthLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}
