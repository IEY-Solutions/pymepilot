/**
 * Badge de notificaciones no leidas.
 *
 * QUE HACE: Muestra un circulo rojo con el numero de notificaciones
 * pendientes. Se posiciona relativo al elemento padre (el icono del menu).
 *
 * POR QUE: El usuario necesita ver de un vistazo si tiene notificaciones
 * sin leer, sin tener que navegar a /datos.
 *
 * CONCEPTO - Presentational Component:
 * Este componente solo muestra datos (el count). No hace fetch ni
 * maneja estado. Los datos vienen del layout (Server Component).
 */
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
      {count > 9 ? "9+" : count}
    </span>
  );
}
