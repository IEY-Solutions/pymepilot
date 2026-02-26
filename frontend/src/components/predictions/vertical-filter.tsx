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
    color: "bg-gray-100 text-gray-600",
    activeColor: "bg-blue-100 text-blue-700 ring-1 ring-blue-300",
  },
  activacion: {
    label: "Activ.",
    color: "bg-gray-100 text-gray-600",
    activeColor: "bg-green-100 text-green-700 ring-1 ring-green-300",
  },
  recuperacion: {
    label: "Recup.",
    color: "bg-gray-100 text-gray-600",
    activeColor: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
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
            ? "bg-gray-900 text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
              isActive ? config.activeColor : `${config.color} hover:bg-gray-200`
            }`}
          >
            {config.label} {count}
          </button>
        );
      })}
    </div>
  );
}
