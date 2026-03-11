export default function LogrosLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-white/10 rounded" />

      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-white/10 rounded" />
              <div className="h-9 w-9 bg-white/5 rounded-full" />
            </div>
            <div className="h-8 w-16 bg-white/10 rounded" />
            <div className="h-3 w-32 bg-white/5 rounded" />
          </div>
        ))}
      </div>

      {/* Lista de cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2"
          >
            <div className="flex justify-between">
              <div className="h-5 w-32 bg-white/10 rounded" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>
            <div className="h-4 w-48 bg-white/5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
