"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

// ============================================================
// ChatInput — Campo de texto + boton enviar
// ============================================================

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Preguntale algo a PymePilot...",
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize del textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [text]);

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter envia, Shift+Enter nueva linea
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-gray-200 bg-white p-3">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm
                   placeholder:text-gray-400 focus:border-blue-500 focus:outline-none
                   focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   bg-blue-600 text-white transition-colors hover:bg-blue-700
                   disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Enviar mensaje"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
