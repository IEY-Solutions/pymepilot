import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PushBanner } from "@/components/push/push-banner";
import { ChatWrapper } from "@/components/chat/chat-wrapper";
import {
  getCurrentUser,
  getUnreadNotificationsCount,
} from "@/lib/data/dashboard";

// Limites de ejecucion para funciones serverless del dashboard.
// maxDuration/regions no son opciones de next.config.ts en App Router;
// se configuran via Route Segment Config en el layout que agrupa las rutas.
export const maxDuration = 30;
export const preferredRegion = "gru1";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const tenantId = (user?.user_metadata?.tenant_id as string) ?? "anonymous";
  const tenantName = (user?.user_metadata?.full_name as string) ?? "PymePilot";
  const unreadCount = await getUnreadNotificationsCount(tenantId);

  return (
    <ChatWrapper>
      <div className="min-h-screen bg-[#1a2a2c] flex flex-col">
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
