"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";

/**
 * Header — Muestra la marca del tenant (logo + nombre) o "PymePilot"
 * como fallback. Si el tenant configuro su logo, se muestra en lugar
 * del texto "PymePilot".
 */
export function Header({ tenantName }: { tenantName?: string }) {
  const router = useRouter();
  const { branding } = useBranding();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {branding.logo_base64 ? (
          <img
            src={branding.logo_base64}
            alt={tenantName ?? "Logo"}
            className="h-8 w-auto object-contain"
          />
        ) : (
          <span className="text-lg font-bold" style={{ color: branding.primary_color }}>
            PymePilot
          </span>
        )}
        {tenantName && (
          <span className="text-sm text-gray-500 hidden sm:inline">
            | {tenantName}
          </span>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  );
}
