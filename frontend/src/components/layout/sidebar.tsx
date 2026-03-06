"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Clock, Database, BarChart3, Trophy } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/notification-badge";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/contactar", label: "Contactar", icon: MessageSquare },
  { href: "/historial", label: "Historial", icon: Clock },
  { href: "/metricas", label: "Metricas", icon: BarChart3 },
  { href: "/logros", label: "Logros", icon: Trophy },
  { href: "/datos", label: "Datos", icon: Database },
];

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 border-r border-gray-200 bg-white flex-col">
      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/datos" && (
                  <NotificationBadge count={unreadCount} />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
