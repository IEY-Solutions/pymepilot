/**
 * Skeleton de carga para todas las rutas del dashboard.
 *
 * Next.js muestra este componente automaticamente mientras el Server
 * Component de la pagina esta resolviendo sus queries async (Supabase).
 * Sin esto, el usuario ve la pagina anterior (o nada) durante la carga.
 *
 * CONCEPTO - Suspense boundary:
 * Next.js App Router envuelve cada page.tsx en un <Suspense>.
 * loading.tsx es el fallback de ese Suspense. Es como el cartelito
 * de "Cargando..." que aparece mientras la caja registradora procesa.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Skeleton del titulo */}
      <div className="h-8 w-32 bg-gray-200 rounded" />

      {/* Skeleton de 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-gray-200 rounded" />
              <div className="h-8 w-8 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-28 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Skeleton de la card de frescura */}
      <div className="h-16 bg-gray-100 border border-gray-200 rounded-lg" />
    </div>
  );
}
