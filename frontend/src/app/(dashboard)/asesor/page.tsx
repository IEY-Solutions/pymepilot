"use client";

import { ChatPanel } from "@/components/chat/chat-panel";
import { useChat } from "@/contexts/chat-context";
import { Bot, Trash2 } from "lucide-react";

export default function AsesorPage() {
  const { messages, clearChat, usage } = useChat();

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] md:h-[calc(100vh-80px)] -m-4 md:-m-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(129,181,161,0.1)] px-4 py-3 bg-[#1a2a2c]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#81b5a1]/15 flex items-center justify-center">
            <Bot className="h-4 w-4 text-[#81b5a1]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">PymePilot Asesor</h1>
            <p className="text-xs text-white/50">
              Preguntame sobre tu negocio
              {usage && (
                <span className="ml-2 text-white/30">
                  {usage.questions_today}/{usage.daily_limit} consultas hoy
                </span>
              )}
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-white/40
                       hover:bg-white/[0.06] hover:text-white/70 transition-colors"
            title="Limpiar conversacion"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar
          </button>
        )}
      </div>

      <ChatPanel showWelcome={true} className="flex-1 min-h-0" />
    </div>
  );
}
