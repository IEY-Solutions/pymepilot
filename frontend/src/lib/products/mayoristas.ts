import {
  BarChart3,
  BookOpen,
  Bot,
  Columns3,
  Database,
  Home,
  Star,
  Trophy,
} from "lucide-react";

import type {
  DashboardNavItem,
  ProductConfig,
  ProductModuleKey,
} from "@/lib/products/types";

export const MAYORISTAS_PRODUCT: ProductConfig = {
  segment: "mayoristas",
  displayName: "PymePilot Mayoristas",
  defaultModules: ["seguimiento"],
  dashboardNav: [
    { href: "/", label: "Inicio", shortLabel: "Inicio", icon: Home, module: "core" },
    { href: "/pipeline", label: "Pipeline", shortLabel: "Pipeline", icon: Columns3, module: "seguimiento" },
    { href: "/cuentas-clave", label: "Cuentas Clave", shortLabel: "Cuentas", icon: Star, module: "seguimiento" },
    { href: "/metricas", label: "Metricas", shortLabel: "Metricas", icon: BarChart3, module: "core" },
    { href: "/logros", label: "Mis ventas", shortLabel: "Mis ventas", icon: Trophy, module: "seguimiento" },
    {
      href: "/datos",
      label: "Datos",
      shortLabel: "Datos",
      icon: Database,
      module: "core",
      showNotificationBadge: true,
    },
    { href: "/asesor", label: "Asesor IA", shortLabel: "Asesor", icon: Bot, module: "core" },
    { href: "/guia", label: "Guia", shortLabel: "Guia", icon: BookOpen, module: "core" },
  ],
};

export function getMayoristasDashboardNav(
  activeModules: ProductModuleKey[] = MAYORISTAS_PRODUCT.defaultModules,
): DashboardNavItem[] {
  return MAYORISTAS_PRODUCT.dashboardNav.filter((item) => {
    return item.module === "core" || activeModules.includes(item.module);
  });
}
