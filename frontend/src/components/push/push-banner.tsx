"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

export function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    if (Notification.permission !== "default") return;

    if (sessionStorage.getItem("push-banner-dismissed")) return;

    setVisible(true);
  }, []);

  function handleDismiss() {
    sessionStorage.setItem("push-banner-dismissed", "1");
    setVisible(false);
  }

  async function handleSubscribe() {
    setSubscribing(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        // VAPID key no configurada — ocultar banner silenciosamente
        setVisible(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const subJson = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      if (!res.ok) {
        // Error guardando suscripcion — silenciado en client-side
      }
    } catch {
      // Error en suscripcion push — silenciado en client-side
    } finally {
      setSubscribing(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="bg-[#81b5a1]/10 border-b border-[rgba(129,181,161,0.2)] px-4 py-3">
      <div className="max-w-5xl flex items-center gap-3">
        <Bell className="h-5 w-5 text-[#81b5a1] flex-shrink-0" />
        <p className="text-sm text-white/80 flex-1">
          Activa las notificaciones para recibir un resumen diario de tus
          clientes a contactar y enterarte al instante cuando se concrete una
          venta.
        </p>
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="text-sm font-medium px-3 py-1.5 bg-[#81b5a1] text-white rounded-lg hover:bg-[#5a9a84] transition-colors disabled:opacity-50 flex-shrink-0 glow-hover"
        >
          {subscribing ? "Activando..." : "Activar"}
        </button>
        <button
          onClick={handleDismiss}
          className="text-white/30 hover:text-white/60 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
