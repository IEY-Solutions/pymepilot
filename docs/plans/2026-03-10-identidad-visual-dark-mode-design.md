# Design Doc — Identidad Visual PymePilot Dark Mode

**Fecha:** 2026-03-10
**Estado:** Aprobado
**Origen:** Replicar identidad visual de pymepilot.cloud al dashboard

---

## Objetivo

Transformar el dashboard de PymePilot de light mode (fondo blanco, azules default)
a dark mode premium idéntico al sitio web pymepilot.cloud. Incluye paleta de colores,
tipografía Inter, glassmorphism selectivo, animaciones sutiles, y contraste completo
para ~195 elementos UI.

## Decisiones del brainstorming

1. **Dark mode idéntico a la web** (no light mode con teal, no híbrido)
2. **Fuente Inter** reemplaza Geist
3. **Animaciones sutiles** (fadeInUp, hover glow, transiciones — sin pulsos infinitos)
4. **Glassmorphism selectivo** (glass dark en cards principales, glass green en CTAs)

---

## Paleta de colores

| Token | Hex/Valor | Uso |
|-------|-----------|-----|
| `--bg-primary` | `#1a2a2c` | Fondo principal body |
| `--bg-surface` | `rgba(255,255,255,0.06)` | Cards, superficies (glass dark) |
| `--bg-surface-hover` | `rgba(255,255,255,0.10)` | Hover en cards |
| `--teal-500` | `#81b5a1` | Color primario, botones, iconos activos |
| `--teal-600` | `#5a9a84` | Hover/pressed en botones |
| `--teal-400` | `#a3cabb` | Texto de acento claro |
| `--text-primary` | `#ffffff` | Texto principal |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Texto secundario |
| `--text-muted` | `rgba(255,255,255,0.3)` | Placeholders, texto deshabilitado |
| `--border-subtle` | `rgba(129,181,161,0.1)` | Bordes default |
| `--border-accent` | `rgba(129,181,161,0.2)` | Bordes con énfasis |
| `--error` | `#ff5252` | Alertas/errores |
| `--error-light` | `#ff8a80` | Error hover |

### Glassmorphism

```css
/* Glass dark — pipeline cards, métricas cards, modales */
backdrop-filter: blur(20px);
background: rgba(255,255,255,0.06);
border: 1px solid rgba(255,255,255,0.1);
border-radius: 16px;

/* Glass green — botones CTA, badges activos, elementos destacados */
backdrop-filter: blur(16px);
background: rgba(129,181,161,0.08);
border: 1px solid rgba(129,181,161,0.2);
border-radius: 16px;
```

---

## Tipografía

- **Inter** (400, 500, 600, 700, 800) via `next/font/google`
- Reemplaza Geist Sans y Geist Mono
- Tamaños: Tailwind defaults (text-xs a text-5xl)

---

## Mapeo de contraste (~195 elementos)

### Textos

| Clase actual | Clase nueva | Contexto |
|---|---|---|
| `text-gray-900` | `text-white` | Títulos, headings, nombres |
| `text-gray-800` | `text-white` | Texto de cuerpo importante |
| `text-gray-700` | `text-white/80` | Labels, texto secondary |
| `text-gray-600` | `text-white/60` | Texto terciario |
| `text-gray-500` | `text-white/50` | Subtítulos, metadata |
| `text-gray-400` | `text-white/40` | Placeholders, hints |
| `text-gray-300` | `text-white/30` | Texto muy sutil |
| `text-blue-600` | `text-[#81b5a1]` | Logo, acentos, links |
| `text-blue-700` | `text-[#a3cabb]` | Iconos activos |

### Fondos

| Clase actual | Clase nueva |
|---|---|
| `bg-white` | `bg-[#1a2a2c]` o glass dark |
| `bg-gray-50` | `bg-white/[0.03]` |
| `bg-gray-100` | `bg-white/[0.06]` |
| `bg-gray-200` | `bg-white/[0.10]` |
| `bg-blue-50` | `bg-[#81b5a1]/10` |
| `bg-blue-100` | `bg-[#81b5a1]/15` |

### Bordes

| Clase actual | Clase nueva |
|---|---|
| `border-gray-100` | `border-white/[0.06]` |
| `border-gray-200` | `border-[rgba(129,181,161,0.1)]` |
| `border-gray-300` | `border-[rgba(129,181,161,0.2)]` |

### Badges de prioridad (pipeline)

| Actual | Nuevo |
|---|---|
| `bg-red-100 text-red-700` | `bg-red-500/20 text-red-400` |
| `bg-orange-100 text-orange-700` | `bg-orange-500/20 text-orange-400` |
| `bg-yellow-100 text-yellow-700` | `bg-yellow-500/20 text-yellow-400` |
| `bg-blue-100 text-blue-700` | `bg-[#81b5a1]/20 text-[#a3cabb]` |
| `bg-gray-100 text-gray-600` | `bg-white/10 text-white/50` |

### Badges de vertical (mantienen colores, adaptan a dark)

| Actual | Nuevo |
|---|---|
| `bg-blue-100 text-blue-700` | `bg-blue-500/20 text-blue-400` |
| `bg-green-100 text-green-700` | `bg-green-500/20 text-green-400` |
| `bg-amber-100 text-amber-700` | `bg-amber-500/20 text-amber-400` |
| `bg-indigo-100 text-indigo-700` | `bg-indigo-500/20 text-indigo-400` |

---

## Gráficos Recharts

| Elemento | Valor actual | Valor nuevo |
|---|---|---|
| CartesianGrid stroke | `#f3f4f6` | `rgba(129,181,161,0.1)` |
| XAxis tick fill | `#9ca3af` | `rgba(255,255,255,0.5)` |
| YAxis tick fill | `#9ca3af` | `rgba(255,255,255,0.5)` |
| XAxis axisLine stroke | `#e5e7eb` | `rgba(129,181,161,0.2)` |
| Tooltip background | `bg-white` | `bg-[#1a2a2c]/95 backdrop-blur-lg` |
| Tooltip border | `border-gray-100` | `border-[rgba(129,181,161,0.2)]` |
| Tooltip label text | `text-gray-400` | `text-white/50` |
| Tooltip value text | `text-gray-900` | `text-white` |
| Legend text | `text-gray-500` | `text-white/60` |
| Line colors (revenue) | indigo/emerald/amber | `#81b5a1` / `#a3cabb` / `#f59e0b` |
| Bar colors | `#6366f1` | `#81b5a1` (primario teal) |

---

## Inputs/Forms

| Actual | Nuevo |
|---|---|
| `bg-white border-gray-300` | `bg-white/[0.06] border-[rgba(129,181,161,0.2)]` |
| `placeholder:text-gray-400` | `placeholder:text-white/30` |
| `focus:border-blue-500 focus:ring-blue-500` | `focus:border-[#81b5a1] focus:ring-[#81b5a1]` |
| texto implícito negro | `text-white` |

---

## Shadows

| Actual | Nuevo |
|---|---|
| `shadow-sm`, `shadow-md` | `shadow-[0_8px_32px_rgba(0,0,0,0.4)]` |
| hover `shadow-md` | `shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(129,181,161,0.1)]` |

---

## Animaciones (sutiles)

- **fadeInUp**: cards al montar (`opacity 0→1, translateY(20px)→0, 0.4s ease-out`)
- **Hover glow**: botones primarios (`box-shadow: 0 4px 20px rgba(129,181,161,0.4)`)
- **Transiciones**: todos los hover con `transition-all duration-200 ease-in-out`
- **Sin**: pulsos infinitos, floats, shimmer constante

---

## Archivos afectados (25 archivos)

### Layout
- `frontend/src/app/globals.css` — theme colors, Inter font, animaciones
- `frontend/src/app/layout.tsx` — Geist → Inter
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/components/layout/header.tsx`
- `frontend/src/components/layout/bottom-nav.tsx`
- `frontend/src/components/layout/footer.tsx`

### Pipeline
- `frontend/src/components/pipeline/pipeline-card.tsx`
- `frontend/src/components/pipeline/pipeline-column.tsx`
- `frontend/src/components/pipeline/contact-modal.tsx`

### Chat
- `frontend/src/components/chat/chat-bubble.tsx`
- `frontend/src/components/chat/chat-panel.tsx`
- `frontend/src/components/chat/chat-message.tsx`
- `frontend/src/components/chat/chat-input.tsx`

### Métricas (charts)
- `frontend/src/app/(dashboard)/metricas/charts/revenue-chart.tsx`
- `frontend/src/app/(dashboard)/metricas/charts/value-chart.tsx`
- `frontend/src/app/(dashboard)/metricas/charts/ticket-chart.tsx`
- `frontend/src/app/(dashboard)/metricas/charts/churn-chart.tsx`
- `frontend/src/app/(dashboard)/metricas/metricas-content.tsx`
- `frontend/src/app/(dashboard)/metricas/client-detail.tsx`
- `frontend/src/app/(dashboard)/metricas/client-ranking-table.tsx`
- `frontend/src/app/(dashboard)/metricas/product-ranking-table.tsx`

### Páginas
- `frontend/src/app/(dashboard)/page.tsx` (home)
- `frontend/src/app/(dashboard)/datos/page.tsx`
- `frontend/src/app/(dashboard)/asesor/page.tsx`
- `frontend/src/app/(dashboard)/logros/logros-content.tsx`
- `frontend/src/app/(dashboard)/logros/components/achievement-card.tsx`
- `frontend/src/app/login/page.tsx`

### Otros componentes
- `frontend/src/components/upload/file-upload.tsx`
- `frontend/src/components/drive/drive-connection.tsx`
- `frontend/src/components/datos/erp-status-card.tsx`
- `frontend/src/components/push/push-banner.tsx`
- `frontend/src/components/predictions/vertical-filter.tsx`
- `frontend/src/components/ui/info-tooltip.tsx`
- `frontend/src/lib/freshness.ts`
- `frontend/src/lib/pipeline/types.ts`

### Lo que NO cambia
- Lógica de negocio, funcionalidad, estructura de páginas
- Colores semánticos de verticales (reposición=blue, activación=green,
  recuperación=orange, cross-sell=purple) — se adaptan a dark, no se eliminan
- shadcn/ui internals (se adaptan via CSS variables)

---

## Login page

- Dark mode `#1a2a2c` como fondo
- Glass dark para el formulario
- Logo/título en teal `#81b5a1`
- Inputs con estilo glass (bg-white/6, border teal sutil)
