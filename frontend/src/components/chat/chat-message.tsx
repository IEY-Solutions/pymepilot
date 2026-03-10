"use client";

import type { ChatMessage } from "@/lib/chat/types";

// ============================================================
// ChatMessageBubble — Burbuja individual de mensaje
// ============================================================
// Concepto: Cada mensaje en el chat es una burbuja. Las del
// usuario van a la derecha (azul), las del asistente a la
// izquierda (gris). Es el patron visual de WhatsApp/iMessage.
// ============================================================

interface Props {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-brand-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 rounded-bl-md"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}
