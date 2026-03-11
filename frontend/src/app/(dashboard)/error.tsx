"use client";

/**
 * Error boundary para todas las rutas del dashboard.
 *
 * Next.js muestra este componente cuando un Server Component lanza
 * una excepcion no capturada (ej: Supabase caido, timeout de red).
 * Sin esto, el error sube hasta el root y el usuario ve una pantalla
 * blanca o el error generico de Next.js.
 *
 * CONCEPTO - Error boundary:
 * React "atrapa" el error en este nivel y muestra una UI alternativa
 * en vez de romper toda la app. Es como un fusible: se quema este
 * circuito pero el resto de la casa sigue con luz.
 *
 * IMPORTANTE: Debe ser "use client" — los error boundaries solo
 * funcionan como Client Components en Next.js App Router.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold text-red-400 mb-2">
          Algo salio mal
        </h2>
        <p className="text-sm text-red-300/80 mb-4">
          No pudimos cargar los datos. Puede ser un problema temporal de
          conexion.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600/80 rounded-lg hover:bg-red-600 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
