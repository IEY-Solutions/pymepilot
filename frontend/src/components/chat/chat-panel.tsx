"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/contexts/chat-context";
import { ChatMessageBubble } from "./chat-message";
import { ChatInput } from "./chat-input";
import { Bot, Loader2, RotateCcw } from "lucide-react";

interface Props {
  showWelcome?: boolean;
  className?: string;
}

export function ChatPanel({ showWelcome = true, className = "" }: Props) {
  const { messages, isLoading, error, errorType, canRetry, retryAfter, usage, sendMessage, retry } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const limitReached = usage && usage.questions_today >= usage.daily_limit;

  return (
    <div className={`flex flex-col bg-[#1a2a2c] ${className}`}>
      {/* Area de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Bienvenida cuando no hay mensajes */}
        {showWelcome && messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#81b5a1]/15 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-[#81b5a1]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              PymePilot Asesor
            </h3>
            <p className="text-sm text-white/50 max-w-xs mb-4">
              Preguntame sobre tus ventas, clientes, productos o predicciones.
              Conozco todos tus datos.
            </p>
            <div className="space-y-2">
              {[
                "Como viene el negocio este mes?",
                "Quienes son mis mejores clientes?",
                "Que productos se venden mas?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="block w-full text-left text-sm text-[#a3cabb] glass-green
                             px-3 py-2 hover:bg-[#81b5a1]/15 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensajes */}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}

        {/* Indicador de carga */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-2.5 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" />
              PymePilot esta pensando...
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center gap-2">
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
            {canRetry && (
              <button
                onClick={retry}
                className="flex items-center gap-1.5 rounded-md bg-[#81b5a1]/15 px-3 py-1.5 text-sm text-[#81b5a1] hover:bg-[#81b5a1]/25 transition-colors"
                aria-label="Reintentar"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            )}
            {errorType === "rate_limit" && retryAfter !== null && (
              <div className="text-xs text-amber-400">
                Disponible a las{" "}
                {new Date(Date.now() + retryAfter * 1000).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Limite alcanzado */}
      {limitReached && (
        <div className="border-t border-[rgba(129,181,161,0.1)] bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-400">
          Alcanzaste el limite de {usage.daily_limit} consultas de hoy. Se reinicia manana.
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={sendMessage}
        disabled={isLoading || !!limitReached}
        placeholder={
          limitReached
            ? "Limite de consultas alcanzado"
            : "Preguntale algo a PymePilot..."
        }
      />

      {/* Contador de uso */}
      {usage && !limitReached && (
        <div className="border-t border-[rgba(129,181,161,0.1)] bg-white/[0.03] px-4 py-1 text-center text-xs text-white/30">
          {usage.questions_today}/{usage.daily_limit} consultas hoy
        </div>
      )}
    </div>
  );
}
