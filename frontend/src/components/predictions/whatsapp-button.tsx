"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";

export function WhatsAppButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    // 1. Copiar mensaje al portapapeles
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback para browsers sin clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    // 2. Mostrar feedback visual
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);

    // 3. Abrir WhatsApp (el vendedor busca al cliente y pega)
    window.open("https://wa.me/", "_blank");
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-green-50 text-green-700 hover:bg-green-100"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" />
          Copiado
        </>
      ) : (
        <>
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </>
      )}
    </button>
  );
}
