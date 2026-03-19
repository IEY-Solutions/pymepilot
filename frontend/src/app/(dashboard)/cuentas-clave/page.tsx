import { createClient } from "@/lib/supabase/server";
import { KeyAccountsGrid } from "@/components/key-accounts/key-accounts-grid";
import type { KeyAccount, HealthScore } from "@/lib/key-accounts/types";

export default async function CuentasClavePage() {
  const supabase = await createClient();

  // Fetch key_accounts activas con join a customers (read-only)
  const { data: rawAccounts, error } = await supabase
    .from("key_accounts")
    .select(
      `id, tenant_id, customer_id, status, health_score, health_override,
       source, notes_count, pending_actions_count, created_at, created_by,
       customer:customers!inner(name, phone, email, total_purchases_amount, last_purchase_date)`
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-4">Cuentas Clave</h1>
        <p className="text-red-400 bg-red-500/15 p-4 rounded-lg">
          Error al cargar cuentas clave. Intenta recargar la pagina.
        </p>
      </div>
    );
  }

  // Ensamblar accounts con defaults para campos calculados
  const accounts: KeyAccount[] = (rawAccounts ?? []).map((a) => ({
    ...a,
    customer: Array.isArray(a.customer)
      ? (a.customer as unknown as KeyAccount["customer"][])[0]
      : (a.customer as unknown as KeyAccount["customer"]),
    health_score: ((a.health_override ?? a.health_score) as HealthScore),
    last_note_date: null,
    last_note_type: null,
    active_alerts_count: 0,
    has_future_alert: false,
  }));

  return <KeyAccountsGrid initialAccounts={accounts} />;
}
