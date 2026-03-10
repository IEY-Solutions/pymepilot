import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PushBanner } from "@/components/push/push-banner";
import { ChatWrapper } from "@/components/chat/chat-wrapper";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [{ data: { user } }, notificationsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("read", false),
  ]);

  // Obtener nombre del tenant desde app_metadata del JWT
  const tenantName = user?.user_metadata?.full_name ?? "PymePilot";
  const unreadCount = notificationsRes.count ?? 0;

  return (
    <ChatWrapper>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header tenantName={tenantName} />
        <PushBanner />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar unreadCount={unreadCount} />
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <div className="p-4 md:p-6">{children}</div>
          </main>
        </div>
        <BottomNav unreadCount={unreadCount} />
      </div>
    </ChatWrapper>
  );
}
