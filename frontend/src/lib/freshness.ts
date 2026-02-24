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

  const ageMs = Date.now() - new Date(lastSyncDate).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageDays = Math.floor(ageHours / 24);

  if (ageHours < 24) {
    return {
      color: "green",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
      textClass: "text-green-800",
      label: "Datos actualizados",
      message: `Ultima actualizacion hace ${Math.floor(ageHours)} hora${Math.floor(ageHours) !== 1 ? "s" : ""}`,
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
