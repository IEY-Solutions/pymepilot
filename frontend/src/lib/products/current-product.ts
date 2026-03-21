import { MAYORISTAS_PRODUCT, getMayoristasDashboardNav } from "@/lib/products/mayoristas";
import type {
  DashboardNavItem,
  ProductConfig,
  ProductModuleKey,
} from "@/lib/products/types";

// Punto unico de resolucion del producto visible.
// Hoy la app opera como "PymePilot Mayoristas".
// Cuando exista un segundo segmento real, este helper debera resolver
// segment + active_modules desde el tenant autenticado.
export function getCurrentProduct(): ProductConfig {
  return MAYORISTAS_PRODUCT;
}

export function getCurrentDashboardNav(
  activeModules: ProductModuleKey[] = getCurrentProduct().defaultModules,
): DashboardNavItem[] {
  return getMayoristasDashboardNav(activeModules);
}
