"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Clock, Database } from "lucide-react";
import { NotificationBadge } from "@/components/notifications/notification-badge";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/contactar", label: "Contactar", icon: MessageSquare },
  { href: "/historial", label: "Historial", icon: Clock },
  { href: "/datos", label: "Datos", icon: Database },
];

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white z-50">
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
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
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
