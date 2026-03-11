/**
 * Skeleton de carga para la pagina de metricas.
 * Muestra 4 KPI cards + area de graficos mientras cargan los datos.
 */
export default function MetricasLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Titulo + selector de meses */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-white/10 rounded" />
        <div className="h-9 w-32 bg-white/10 rounded" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-white/10 rounded" />
              <div className="h-8 w-8 bg-white/5 rounded-lg" />
            </div>
            <div className="h-7 w-16 bg-white/10 rounded" />
            <div className="h-3 w-28 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Area de graficos (2x2 grid) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3"
          >
            <div className="h-5 w-32 bg-white/10 rounded" />
            <div className="h-48 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Ranking de clientes */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
        <div className="h-5 w-40 bg-white/10 rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
