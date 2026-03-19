/**
 * Mapa de composiciones Remotion por section ID.
 * Usa dynamic imports para lazy loading.
 */
export const compositionMap: Record<string, () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>> = {
  inicio: () => import("./inicio"),
  pipeline: () => import("./pipeline"),
  "cuentas-clave": () => import("./cuentas-clave"),
  metricas: () => import("./metricas"),
  "mis-ventas": () => import("./mis-ventas"),
  datos: () => import("./datos"),
  asesor: () => import("./asesor"),
};
