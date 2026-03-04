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
