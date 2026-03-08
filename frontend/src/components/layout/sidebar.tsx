"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Clock, Database, BarChart3, Trophy, Bot, Columns3 } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/notification-badge";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/contactar", label: "Contactar", icon: MessageSquare },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/historial", label: "Historial", icon: Clock },
  { href: "/metricas", label: "Metricas", icon: BarChart3 },
  { href: "/logros", label: "Mis ventas", icon: Trophy },
  { href: "/datos", label: "Datos", icon: Database },
  { href: "/asesor", label: "Asesor IA", icon: Bot },
];

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-14 border-r border-gray-200 bg-white flex-col items-center">
      <nav className="flex-1 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`relative group flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/datos" && (
                  <NotificationBadge count={unreadCount} />
                )}
              </span>
              {/* Tooltip on hover */}
              <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-gray-800 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
