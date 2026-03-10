"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useChat } from "@/contexts/chat-context";
import { Bot, Trash2 } from "lucide-react";

// ============================================================
// Pagina /asesor — Chat fullscreen
// ============================================================
// Misma conversacion que la burbuja flotante (estado compartido
// via ChatContext). La diferencia es que aca el chat ocupa
// toda la pantalla, ideal para conversaciones largas.
// ============================================================

export default function AsesorPage() {
  const { messages, clearChat, usage } = useChat();

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] -m-4 md:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
            <Bot className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-800">PymePilot Asesor</h1>
            <p className="text-xs text-gray-500">
              Preguntame sobre tu negocio
              {usage && (
                <span className="ml-2 text-gray-400">
                  {usage.questions_today}/{usage.daily_limit} consultas hoy
                </span>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-500
                       hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title="Limpiar conversacion"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {/* Chat panel fullscreen */}
      <ChatPanel showWelcome={true} className="flex-1 min-h-0" />
    </div>
  );
}
