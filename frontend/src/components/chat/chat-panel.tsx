"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@/contexts/chat-context";
import { ChatMessageBubble } from "./chat-message";
import { ChatInput } from "./chat-input";
import { Bot, Loader2 } from "lucide-react";

// ============================================================
// ChatPanel — Panel de chat reutilizable
// ============================================================
// Se usa tanto en la burbuja flotante como en la pagina /asesor.
// Muestra los mensajes, el indicador de carga, y el input.
// Concepto: "Componente reutilizable" — escribis la UI una sola
// vez y la usas en multiples lugares.
// ============================================================

interface Props {
  /** Si true, muestra un estado de bienvenida cuando no hay mensajes */
  showWelcome?: boolean;
  /** Clases extra para el contenedor */
  className?: string;
}

export function ChatPanel({ showWelcome = true, className = "" }: Props) {
  const { messages, isLoading, error, usage, sendMessage } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al ultimo mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const limitReached = usage && usage.questions_today >= usage.daily_limit;

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Area de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Bienvenida cuando no hay mensajes */}
        {showWelcome && messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">
              PymePilot Asesor
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mb-4">
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
                  className="block w-full text-left text-sm text-blue-600 bg-blue-50
                             rounded-lg px-3 py-2 hover:bg-blue-100 transition-colors"
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
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              PymePilot esta pensando...
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex justify-center">
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Limite alcanzado */}
      {limitReached && (
        <div className="border-t border-gray-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700">
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
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-1 text-center text-xs text-gray-400">
          {usage.questions_today}/{usage.daily_limit} consultas hoy
        </div>
      )}
    </div>
  );
}
