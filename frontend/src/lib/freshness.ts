/**
 * Calcula la antiguedad de la ultima sync y retorna color + texto descriptivo.
 *
 * Compartido entre la home page y la pagina de datos.
 *
 * Escala visual:
 * - Verde (<24h): datos frescos
 * - Amarillo (24-72h): datos algo viejos
 * - Rojo (>72h): datos muy viejos, predicciones menos precisas
 */
export function getFreshnessInfo(lastSyncDate: string | null): {
  color: "green" | "yellow" | "red";
  bgClass: string;
  borderClass: string;
  textClass: string;
  label: string;
  message: string;
} | null {
  if (!lastSyncDate) return null;

  // M-06 FIX: Validar que la fecha es parseable.
  // Si lastSyncDate es un string invalido, new Date() retorna NaN
  // y todas las comparaciones fallan → siempre cae en rojo.
  const parsed = new Date(lastSyncDate).getTime();
  if (isNaN(parsed)) return null;

  // M-06 FIX: Fecha futura (bug en servidor o timezone) → tratar como fresco
  const ageMs = Math.max(0, Date.now() - parsed);
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = Math.floor(ageHours / 24);

  if (ageHours < 24) {
    // L-05 FIX: "hace 0 horas" → "hace menos de 1 hora"
    // Consistente con timeAgo() en page.tsx que ya maneja este caso.
    const hoursLabel = ageHours < 1
      ? "hace menos de 1 hora"
      : `hace ${Math.floor(ageHours)} hora${Math.floor(ageHours) !== 1 ? "s" : ""}`;
    return {
      color: "green",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
      textClass: "text-green-800",
      label: "Datos actualizados",
      message: `Ultima actualizacion ${hoursLabel}`,
    };
  }

  if (ageHours < 72) {
    return {
      color: "yellow",
      bgClass: "bg-yellow-50",
      borderClass: "border-yellow-200",
      textClass: "text-yellow-800",
      label: `Datos de hace ${ageDays} dia${ageDays !== 1 ? "s" : ""}`,
      message: "Subi datos nuevos para mejorar la precision de las predicciones.",
    };
  }

  return {
    color: "red",
    bgClass: "bg-red-50",
    borderClass: "border-red-200",
    textClass: "text-red-800",
    label: `Datos de hace ${ageDays} dias`,
    message: "Las predicciones pueden ser imprecisas. Subi datos actualizados.",
  };
}
