"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Database, BarChart3, Trophy, Columns3 } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/notification-badge";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/metricas", label: "Metricas", icon: BarChart3 },
  { href: "/logros", label: "Mis ventas", icon: Trophy },
  { href: "/datos", label: "Datos", icon: Database },
];

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[rgba(129,181,161,0.1)] bg-[#1a2a2c] z-50">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors ${
                isActive
                  ? "text-[#81b5a1]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <span className="relative">
                <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                {item.href === "/datos" && (
                  <NotificationBadge count={unreadCount} />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
