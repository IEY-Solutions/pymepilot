"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

export function PushBanner() {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    // Solo mostrar si el navegador soporta push y no pidio permiso aun
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return;
    }

    // Si ya acepto o rechazo, no mostrar
    if (Notification.permission !== "default") return;

    // Si ya lo descarto en esta sesion, no mostrar
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

      // Registrar service worker
      const registration = await navigator.serviceWorker.register("/sw.js");

      // Obtener VAPID public key del env
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY no configurada");
        setVisible(false);
        return;
      }

      // Suscribir al push (applicationServerKey acepta string base64url directamente)
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // Enviar suscripcion al backend
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
        console.error("Error guardando suscripcion:", await res.text());
      }
    } catch (err) {
      console.error("Error en suscripcion push:", err);
    } finally {
      setSubscribing(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="bg-brand-50 border-b border-brand-100 px-4 py-3">
      <div className="max-w-5xl flex items-center gap-3">
        <Bell className="h-5 w-5 text-brand-600 flex-shrink-0" />
        <p className="text-sm text-brand-800 flex-1">
          Activa las notificaciones para recibir un resumen diario de tus
          clientes a contactar y enterarte al instante cuando se concrete una
          venta.
        </p>
        <button
          onClick={handleSubscribe}
          disabled={subscribing}
          className="text-sm font-medium px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {subscribing ? "Activando..." : "Activar"}
        </button>
        <button
          onClick={handleDismiss}
          className="text-brand-400 hover:text-brand-600 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

