/**
 * Formatea un numero como moneda compacta ($1.5M, $50k, $123).
 * Centralizado para evitar 7 copias con variaciones.
 */
export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
