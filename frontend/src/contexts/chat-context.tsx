"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ChatMessage, ChatResponse, ChatErrorResponse, ChatErrorType } from "@/lib/chat/types";

// ============================================================
// ChatContext — Estado compartido del chatbot
// ============================================================
// Concepto: React Context permite que la burbuja flotante y
// la pagina /asesor compartan el mismo estado de conversacion.
// Cuando escribis un mensaje en la burbuja, aparece tambien
// en /asesor y viceversa. Es como tener una variable global
// pero controlada y segura.
// ============================================================

export interface ChatContextType {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  errorType: ChatErrorType | null;
  canRetry: boolean;
  retryAfter: number | null;
  usage: { questions_today: number; daily_limit: number } | null;
  sendMessage: (text: string) => Promise<void>;
  retry: () => void;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ChatErrorType | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [usage, setUsage] = useState<{ questions_today: number; daily_limit: number } | null>(null);

  // Ref para evitar doble-envio si el usuario hace click rapido
  const sendingRef = useRef(false);
  // Ref para recordar el ultimo mensaje del usuario y poder reintentar
  const lastUserMessageRef = useRef<string | null>(null);

  function parseError(
    res: Response,
    errorData: ChatErrorResponse
  ): { error: string; type: ChatErrorType; canRetry: boolean; retryAfter: number | null } {
    const errorText = errorData.error ?? "";
    const retryAfter = errorData.retry_after ?? null;

    if (res.status === 429 || errorText.includes("Límite de consultas")) {
      return {
        error: errorText,
        type: "rate_limit",
        canRetry: false,
        retryAfter,
      };
    }

    if (
      res.status === 503 ||
      errorText.includes("no está disponible") ||
      errorText.includes("no disponible")
    ) {
      return {
        error: errorText,
        type: "timeout",
        canRetry: true,
        retryAfter: null,
      };
    }

    if (errorText.includes("Error de conexion") || res.status === 0) {
      return {
        error: errorText,
        type: "network",
        canRetry: true,
        retryAfter: null,
      };
    }

    return {
      error: errorText,
      type: "unknown",
      canRetry: false,
      retryAfter: null,
    };
  }

  const sendMessage = useCallback(async (text: string) => {
    if (sendingRef.current || !text.trim()) return;
    sendingRef.current = true;
    setError(null);
    setErrorType(null);
    setCanRetry(false);
    setRetryAfter(null);

    const trimmedText = text.trim();
    lastUserMessageRef.current = trimmedText;

    // Agregar mensaje del usuario a la UI inmediatamente
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Construir historial para la API (solo texto, sin IDs ni timestamps)
      const history = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedText, history }),
      });

      const data: ChatResponse | ChatErrorResponse = await res.json();

      if (!res.ok || "error" in data) {
        const errorData = data as ChatErrorResponse;
        const parsed = parseError(res, errorData);
        setError(parsed.error);
        setErrorType(parsed.type);
        setCanRetry(parsed.canRetry);
        setRetryAfter(parsed.retryAfter);
        // Remover el mensaje del usuario si hubo error de limite
        if (res.status === 429) {
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        }
        return;
      }

      const successData = data as ChatResponse;

      // Agregar respuesta del asistente
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: successData.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setUsage(successData.usage);
    } catch {
      setError("Error de conexion. Verifica tu internet e intenta de nuevo.");
      setErrorType("network");
      setCanRetry(true);
      setRetryAfter(null);
    } finally {
      setIsLoading(false);
      sendingRef.current = false;
    }
  }, [messages]);

  const retry = useCallback(() => {
    const lastMessage = lastUserMessageRef.current;
    if (lastMessage && canRetry) {
      sendMessage(lastMessage);
    }
  }, [canRetry, sendMessage]);

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setErrorType(null);
    setCanRetry(false);
    setRetryAfter(null);
    setUsage(null);
    lastUserMessageRef.current = null;
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isOpen,
        isLoading,
        error,
        errorType,
        canRetry,
        retryAfter,
        usage,
        sendMessage,
        retry,
        toggleChat,
        openChat,
        closeChat,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat debe usarse dentro de un ChatProvider");
  }
  return context;
}
