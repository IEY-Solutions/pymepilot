"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function Header({ tenantName }: { tenantName?: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 border-b border-[rgba(129,181,161,0.1)] bg-[#1a2a2c] flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-[#81b5a1]">PymePilot</span>
        {tenantName && (
          <span className="text-sm text-white/50 hidden sm:inline">
            | {tenantName}
          </span>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </header>
  );
}
