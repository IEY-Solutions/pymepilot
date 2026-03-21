"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBadge } from "@/components/notifications/notification-badge";
import { getCurrentDashboardNav } from "@/lib/products/current-product";

export function Sidebar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  const navItems = getCurrentDashboardNav();

  return (
    <aside className="hidden md:flex w-14 border-r border-[rgba(129,181,161,0.1)] bg-[#1a2a2c] flex-col items-center">
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
                  ? "bg-[#81b5a1]/15 text-[#81b5a1]"
                  : "text-white/40 hover:bg-white/[0.06] hover:text-white/70"
              }`}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.showNotificationBadge && (
                  <NotificationBadge count={unreadCount} />
                )}
              </span>
              {/* Tooltip on hover */}
              <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium text-white bg-black/80 backdrop-blur-sm rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
