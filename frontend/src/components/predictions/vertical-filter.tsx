"use client";

interface VerticalFilterProps {
  predictions: { vertical: string }[];
  activeFilter: string | null;
  onFilter: (vertical: string | null) => void;
}

const verticalConfig: Record<
  string,
  { label: string; color: string; activeColor: string }
> = {
  reposicion: {
    label: "Repos.",
    color: "bg-white/10 text-white/50",
    activeColor: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40",
  },
  activacion: {
    label: "Activ.",
    color: "bg-white/10 text-white/50",
    activeColor: "bg-green-500/20 text-green-400 ring-1 ring-green-500/40",
  },
  recuperacion: {
    label: "Recup.",
    color: "bg-white/10 text-white/50",
    activeColor: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40",
  },
  cross_sell: {
    label: "Cross-sell",
    color: "bg-white/10 text-white/50",
    activeColor: "bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40",
  },
};

export function VerticalFilter({
  predictions,
  activeFilter,
  onFilter,
}: VerticalFilterProps) {
  const counts: Record<string, number> = {};
  for (const p of predictions) {
    counts[p.vertical] = (counts[p.vertical] || 0) + 1;
  }

  const total = predictions.length;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onFilter(null)}
        className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
          activeFilter === null
            ? "bg-white text-[#1a2a2c]"
            : "bg-white/10 text-white/50 hover:bg-white/15"
        }`}
      >
        Todas {total}
      </button>

      {Object.entries(verticalConfig).map(([key, config]) => {
        const count = counts[key] || 0;
        if (count === 0) return null;

        const isActive = activeFilter === key;

        return (
          <button
            key={key}
            onClick={() => onFilter(isActive ? null : key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              isActive ? config.activeColor : `${config.color} hover:bg-white/15`
            }`}
          >
            {config.label} {count}
          </button>
        );
      })}
    </div>
  );
}
