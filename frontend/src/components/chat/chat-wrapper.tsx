"use client";

import { ChatProvider } from "@/contexts/chat-context";
import { ChatBubble } from "./chat-bubble";

// ============================================================
// ChatWrapper — Envuelve la app con el ChatProvider + Bubble
// ============================================================
// Concepto: Los Server Components de Next.js no pueden usar
// contextos de React (que son client-only). Este wrapper es
// un Client Component que envuelve los children del layout
// con el ChatProvider y agrega la burbuja flotante.
// ============================================================

export function ChatWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      {children}
      <ChatBubble />
    </ChatProvider>
  );
}
