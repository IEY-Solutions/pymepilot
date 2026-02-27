# Design Doc: Visual Polish /metricas — Estilo Stripe

**Fecha:** 2026-02-28
**Enfoque:** Tailwind puro (sin nuevas dependencias)
**Referencia visual:** Stripe Dashboard

---

## Objetivo

Mejorar la estetica de /metricas para que transmita profesionalismo.
No cambiar funcionalidad ni datos, solo presentacion visual.

---

## Seccion 1: KPI Cards

### Cambios

| Propiedad | Antes | Despues |
|-----------|-------|---------|
| Container | `border border-gray-200 rounded-xl p-4` | `rounded-xl shadow-sm hover:shadow-md transition-shadow p-5` |
| Numero KPI | `text-2xl font-bold text-gray-900` | `text-3xl font-bold tracking-tight text-gray-900` |
| Icono | `p-2 rounded-lg bg-{color}-50` | `p-2.5 rounded-full bg-gradient-to-br from-{color}-50 to-{color}-100` |
| Subtitulo | `text-xs text-gray-400` | `text-sm text-gray-500` |
| Titulo | `text-sm font-medium text-gray-500` | `text-xs font-medium uppercase tracking-wider text-gray-400` |

### Archivos: `metricas-content.tsx` (componente KpiCard)

---

## Seccion 2: Charts

### Cambios

| Propiedad | Antes | Despues |
|-----------|-------|---------|
| Container | `border border-gray-200 rounded-xl` | `rounded-xl shadow-sm` |
| Grid lines | Default Recharts | `stroke="#f3f4f6"` (gray-100) |
| Tooltip | Default | Custom: bg-white, shadow-lg, rounded-lg, font Geist |
| Colores linea/barra | Saturados (#8b5cf6, #22c55e, #f97316) | Desaturados (#6366f1 indigo, #10b981 emerald, #f59e0b amber) |
| Titulo chart | `text-sm font-medium text-gray-700` | `text-base font-semibold text-gray-900` + subtitulo `text-xs text-gray-500` |

### Custom Tooltip (componente reutilizable)

```tsx
function CustomTooltip({ active, payload, label, formatter }) {
  // bg-white shadow-lg rounded-lg border-0 p-3
  // label en text-xs text-gray-500 uppercase
  // valores en text-sm font-semibold
}
```

### Archivos: 4 charts en `charts/` directory

---

## Seccion 3: Tabla de Clientes

### Cambios

| Propiedad | Antes | Despues |
|-----------|-------|---------|
| Container | `border border-gray-200 rounded-xl` | `rounded-xl shadow-sm` |
| Header | `bg-gray-50 text-xs text-gray-500` | `bg-gray-50/80 text-[11px] uppercase tracking-wider text-gray-400 font-semibold` |
| Ranking #1-3 | Numero plano gris | Badge circular: gold (#f59e0b), silver (#9ca3af), bronze (#cd7f32) |
| Ranking 4+ | Numero plano gris | `text-gray-400 font-medium` |
| Hover fila | `hover:bg-gray-50` | `hover:bg-gray-50/60 transition-colors duration-150` |
| Facturacion | Solo numero | Numero + mini barra de progreso (% vs max) |
| Detalle expandido | `bg-gray-50` plano | `bg-gray-50/50` con mini-cards por producto |
| Nombre cliente | `text-sm font-medium` | `text-sm font-semibold` |

### Mini barra de progreso

```tsx
// Proporcional al cliente #1 (max revenue)
<div className="w-16 h-1.5 bg-gray-100 rounded-full">
  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
</div>
```

### Archivos: `client-ranking-table.tsx`, `client-detail.tsx`

---

## Archivos a modificar (7 total)

1. `metricas-content.tsx` — KpiCard + containers de layout
2. `charts/revenue-chart.tsx` — colores, tooltip, grid
3. `charts/churn-chart.tsx` — colores, tooltip, grid
4. `charts/ticket-chart.tsx` — colores, tooltip, grid
5. `charts/value-chart.tsx` — colores, tooltip, grid
6. `client-ranking-table.tsx` — badges, barra progreso, hover
7. `client-detail.tsx` — estilo del panel expandido

## Archivos nuevos (0)

Ningun archivo nuevo. Todo es polish de lo existente.

## Dependencias nuevas (0)

Ninguna. Solo Tailwind CSS que ya esta.

---

## Criterios de exito

- Cards con sombra, no borde
- Numeros KPI mas grandes y con tracking-tight
- Charts con tooltips custom (no default Recharts)
- Top 3 clientes con badges visuales
- Barra de progreso en facturacion
- Todo responsive (mobile-first)
- No romper funcionalidad existente
