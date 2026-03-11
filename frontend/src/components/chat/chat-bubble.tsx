"use client";

import { useChat } from "@/contexts/chat-context";
import { usePathname } from "next/navigation";
import { ChatPanel } from "./chat-panel";
import { Bot, X } from "lucide-react";

export function ChatBubble() {
  const { isOpen, toggleChat, usage } = useChat();
  const pathname = usePathname();

  // No mostrar la burbuja en /asesor (tiene su propio chat)
  if (pathname === "/asesor") return null;

  return (
    <>
      {/* Boton flotante */}
      <button
        onClick={toggleChat}
        className={`fixed z-50 flex items-center justify-center rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                    transition-all duration-200 hover:scale-105
                    ${isOpen ? "h-10 w-10 bg-white/10 hover:bg-white/20" : "h-14 w-14 bg-[#81b5a1] hover:bg-[#5a9a84] glow-hover"}
                    ${isOpen ? "bottom-[min(85vh,560px)] right-4 md:bottom-[520px] md:right-6" : "bottom-20 right-4 md:bottom-6 md:right-6"}`}
        aria-label={isOpen ? "Cerrar chat" : "Abrir PymePilot Asesor"}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <>
            <Bot className="h-7 w-7 text-white" />
            {/* Badge con contador */}
            {usage && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center
                               rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {usage.questions_today}/{usage.daily_limit}
              </span>
            )}
          </>
        )}
      </button>

      {/* Panel de chat */}
      {isOpen && (
        <div
          className="fixed z-[60] glass-dark shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden
                     bottom-0 left-0 right-0 top-0
                     md:bottom-6 md:right-6 md:left-auto md:top-auto
                     md:w-[400px] md:h-[500px] md:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[rgba(129,181,161,0.2)] bg-[#81b5a1] px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-white" />
              <span className="text-sm font-semibold text-white">PymePilot Asesor</span>
            </div>
            <div className="flex items-center gap-2">
              {usage && (
                <span className="text-xs text-white/70">
                  {usage.questions_today}/{usage.daily_limit}
                </span>
              )}
              <button
                onClick={toggleChat}
                className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Cerrar chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Chat panel */}
          <ChatPanel
            showWelcome={true}
            className="h-[calc(100%-52px)]"
          />
        </div>
      )}
    </>
  );
}
