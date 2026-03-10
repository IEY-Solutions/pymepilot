# Plan de Implementacion — Dark Mode PymePilot

**Fecha:** 2026-03-10
**Design doc:** `2026-03-10-identidad-visual-dark-mode-design.md`
**Estimacion:** 4 pasos secuenciales

---

## Paso 1: Fundacion (globals.css + layout.tsx + Inter font)

### 1.1 Cambiar Geist → Inter en layout.tsx
- Importar `Inter` de `next/font/google` (weights 400,500,600,700,800)
- Eliminar imports de Geist_Sans y Geist_Mono
- Actualizar variable CSS `--font-sans`

### 1.2 Reescribir globals.css
- Definir colores custom en `@theme inline`
- Agregar keyframe `fadeInUp`
- Clases utilitarias: `.glass-dark`, `.glass-green`, `.glow-hover`
- Body: `bg-[#1a2a2c]`, `text-white`, font Inter

### 1.3 Dashboard layout.tsx
- `bg-gray-50` → `bg-[#1a2a2c]`

### 1.4 Login page
- Dark mode completo con glass dark para el form

**Archivos:** globals.css, layout.tsx (root), layout.tsx (dashboard), login/page.tsx

---

## Paso 2: Layout (header, sidebar, bottom-nav)

### 2.1 Header
- `bg-white border-gray-200` → `bg-[#1a2a2c] border-[rgba(129,181,161,0.1)]`
- Logo `text-blue-600` → `text-[#81b5a1]`
- Texto tenant `text-gray-500` → `text-white/50`
- Logout `text-gray-500` → `text-white/40`

### 2.2 Sidebar
- `bg-white border-gray-200` → `bg-[#1a2a2c] border-[rgba(129,181,161,0.1)]`
- Active: `bg-blue-50 text-blue-700` → `bg-[#81b5a1]/15 text-[#81b5a1]`
- Inactive: `text-gray-500` → `text-white/40`
- Hover: `hover:bg-gray-100` → `hover:bg-white/[0.06]`
- Tooltip: `bg-gray-800` → `bg-black/80 backdrop-blur`

### 2.3 Bottom Nav
- `bg-white border-gray-200` → `bg-[#1a2a2c] border-[rgba(129,181,161,0.1)]`
- Active: `text-blue-600` → `text-[#81b5a1]`
- Inactive: `text-gray-400` → `text-white/40`

**Archivos:** header.tsx, sidebar.tsx, bottom-nav.tsx

---

## Paso 3: Paginas y componentes

### 3.1 Home (page.tsx)
- KPI cards: glass dark
- Textos: mapeo gray → white/opacity
- Alertas freshness: adaptar bg/border/text

### 3.2 freshness.ts
- green: `bg-green-500/15 border-green-500/30 text-green-400`
- yellow: `bg-yellow-500/15 border-yellow-500/30 text-yellow-400`
- red: `bg-red-500/15 border-red-500/30 text-red-400`

### 3.3 Pipeline (card, column, contact-modal)
- Cards: glass dark
- COLUMN_COLORS en types.ts: adaptar 100/700 → 500/20 + 400
- VERTICAL_STYLES en types.ts: adaptar 100/700 → 500/20 + 400
- Priority badges: adaptar a dark
- Contact modal: glass dark, textos blancos, inputs dark

### 3.4 Chat (bubble, panel, message, input)
- Panel: glass dark
- Messages: assistant `bg-white/[0.06]`, user `bg-[#81b5a1]`
- Input: dark con borde teal
- Bubble: `bg-[#81b5a1]` con glow

### 3.5 Datos page
- Cards: glass dark
- Textos: mapeo completo
- File upload: dark borders, dark backgrounds
- Drive connection: dark

### 3.6 Asesor page
- Dark background, textos blancos

### 3.7 Logros (logros-content, achievement-card)
- Cards: glass dark
- Vertical badges: dark adapted

### 3.8 Info tooltip
- Dark styling

### 3.9 Push banner, ERP status card, vertical filter
- Dark adapted

**Archivos:** ~20 archivos de componentes y paginas

---

## Paso 4: Graficos Recharts + shadows + animaciones

### 4.1 Charts (revenue, value, ticket, churn)
- CartesianGrid: `stroke="rgba(129,181,161,0.1)"`
- XAxis/YAxis tick: `fill="rgba(255,255,255,0.5)"`
- XAxis axisLine: `stroke="rgba(129,181,161,0.2)"`
- Tooltips: dark glass styling
- Legend text: `text-white/60`
- Bar/Line colors: teal palette
- Card wrappers: glass dark

### 4.2 Ranking tables (client, product)
- Glass dark cards
- Header/rows: dark text mapping
- Toggle buttons: dark styling
- Expanded rows: dark bg

### 4.3 Metricas content + client detail
- All cards: glass dark
- All texts: contrast mapping

### 4.4 Animaciones globales
- fadeInUp en cards principales via CSS class
- Hover glow en botones primarios
- Transiciones suaves en todo

**Archivos:** 4 charts + 2 ranking tables + metricas-content + client-detail

---

## Orden de ejecucion

1. **Paso 1** primero — establece la base visual (sin esto, nada se ve bien)
2. **Paso 2** segundo — layout frame visible inmediatamente
3. **Paso 3** tercero — el grueso del trabajo (~20 archivos)
4. **Paso 4** ultimo — charts y detalles finales

Cada paso se commitea independientemente para facilitar rollback.
