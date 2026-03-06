// Service Worker para Web Push Notifications — PymePilot
// Este archivo vive en /public y se registra desde el banner de push.
// Escucha eventos 'push' del navegador y muestra notificaciones.

self.addEventListener("push", function (event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "PymePilot", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    data: { url: data.url || "/contactar" },
    tag: data.tag || "pymepilot-notification",
  };

  event.waitUntil(self.registration.showNotification(data.title || "PymePilot", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/contactar";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      // Si ya hay una ventana abierta, navegar a la URL
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Si no hay ventana, abrir una nueva
      return clients.openWindow(url);
    })
  );
});
