import type { LucideIcon } from "lucide-react";

export type ProductSegment = "mayoristas" | "servicios" | "minoristas";
export type ProductModuleKey = "seguimiento" | "cotizaciones" | "portal";

export type DashboardNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  module: ProductModuleKey | "core";
  showNotificationBadge?: boolean;
};

export type ProductConfig = {
  segment: ProductSegment;
  displayName: string;
  defaultModules: ProductModuleKey[];
  dashboardNav: DashboardNavItem[];
};
