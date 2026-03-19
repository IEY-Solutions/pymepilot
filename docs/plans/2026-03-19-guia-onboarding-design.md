# Design Doc: Guía de Onboarding con Videos Remotion

**Fecha:** 2026-03-19
**Estado:** Aprobado
**Autor:** Pato + Claude Code

---

## Objetivo

Crear una sección `/guia` en el dashboard que funcione como onboarding práctico y visual para clientes nuevos. Cada módulo de PymePilot tiene su landing scrolleable con videos animados (Remotion) + texto explicativo que recorren cada sección de forma intuitiva.

## Público objetivo

Ambos roles: dueño/gerente de la distribuidora y vendedor/ejecutivo comercial.

## Decisiones de diseño

| Decisión | Elección | Alternativas descartadas |
|----------|----------|--------------------------|
| Ubicación | Página permanente en sidebar (`/guia`) | Pantalla primera vez, modal |
| Videos | Remotion Player embebido (render en browser) | MP4 pre-renderizados, Loom manual |
| Contenido visual | Wrappers de componentes reales + anotaciones | Screenshots estáticos, motion graphics puros |
| Audio | Mudos con texto animado superpuesto | Narración voz, solo texto debajo |
| Autoplay | IntersectionObserver (play al entrar viewport) | Click to play, autoplay global |
| Layout | Zigzag desktop, stack vertical mobile | Tabs, acordeón, wizard |
| Tono | Cercano/informal argentino (tuteo) | Profesional neutro, paso a paso |
| Escalabilidad | Selector de módulos → landing por módulo | Página única sin módulos |

## Arquitectura

### Rutas

```
/guia                    → Selector de módulos (cards)
/guia/[moduleId]         → Landing scrolleable del módulo
```

Rutas dinámicas con App Router. Hoy solo existe "seguimiento".

### Flujo de usuario

1. Click en ícono "Guía" (BookOpen) en sidebar/bottom-nav
2. Ve selector de módulos: "Seguimiento" activo, futuros deshabilitados
3. Click en "Seguimiento" → navega a `/guia/seguimiento`
4. Landing scrolleable con 7 bloques video+texto (zigzag)
5. Videos se auto-reproducen al scrollear, se pausan al salir del viewport
6. Cada bloque tiene CTA "Ir a [sección] →"
7. Botón "← Volver a módulos" para regresar al selector

### Layout de bloques (zigzag)

**Desktop:** bloque impar → video izquierda (60%) + texto derecha (40%). Bloque par → texto izquierda + video derecha.

**Mobile:** siempre video arriba + texto abajo (stack vertical).

## Secciones del módulo "Seguimiento"

7 videos, uno por sección del dashboard:

| # | Sección | Duración | Puntos clave del video |
|---|---------|----------|------------------------|
| 1 | Inicio | ~25s | KPIs, estado del orquestador, frescura de datos |
| 2 | Pipeline | ~35s | Kanban, arrastrar tarjetas, copiar mensaje, seguimientos |
| 3 | Cuentas Clave | ~30s | Grilla de cuentas, health score, notas, alertas |
| 4 | Métricas | ~30s | Gráficos de facturación, churn, ranking, comparar períodos |
| 5 | Mis Ventas | ~25s | Logros, racha, atribución de ventas |
| 6 | Datos | ~30s | Conexión ERP, sync, subir archivos, estado de datos |
| 7 | Asesor IA | ~25s | Chat, preguntas sugeridas, herramientas del asistente |

### Anatomía de cada video (30fps)

1. Fade in del componente wrapper con datos mock (0.5s)
2. Cursor animado se mueve al elemento relevante (1s)
3. Highlight/zoom en zona clave + text overlay explicativo (3-5s)
4. Transición al siguiente punto de interés
5. Repetir 2-4 para 2-3 features
6. Fade out (0.5s)

### Texto acompañante por bloque

- Título con ícono (mismo del sidebar)
- Bajada: 1-2 oraciones de qué es y para qué
- 3-4 bullets accionables
- CTA link a la sección

Tono: tuteo argentino, sin tecnicismos, orientado a "¿por qué me importa esto?"

## Estructura de archivos

### Archivos nuevos (~19)

```
frontend/src/app/(dashboard)/guia/page.tsx                # Selector de módulos
frontend/src/app/(dashboard)/guia/[moduleId]/page.tsx      # Landing scrolleable
frontend/src/lib/guide-modules.ts                          # Config de módulos
frontend/src/lib/guide-content.ts                          # Textos por sección
frontend/src/components/guide/module-card.tsx               # Card del selector
frontend/src/components/guide/section-block.tsx             # Bloque video+texto zigzag
frontend/src/components/guide/video-player.tsx              # Player + IntersectionObserver hook
frontend/src/remotion/compositions/inicio.tsx               # Composición: Inicio
frontend/src/remotion/compositions/pipeline.tsx             # Composición: Pipeline
frontend/src/remotion/compositions/cuentas-clave.tsx        # Composición: Cuentas Clave
frontend/src/remotion/compositions/metricas.tsx             # Composición: Métricas
frontend/src/remotion/compositions/mis-ventas.tsx           # Composición: Mis Ventas
frontend/src/remotion/compositions/datos.tsx                # Composición: Datos
frontend/src/remotion/compositions/asesor.tsx               # Composición: Asesor IA
frontend/src/remotion/components/annotation.tsx             # Flechas SVG, highlights, zoom
frontend/src/remotion/components/text-overlay.tsx           # Subtítulos animados
frontend/src/remotion/components/cursor.tsx                 # Cursor falso animado
frontend/src/remotion/data/mock-data.ts                     # Datos ficticios
frontend/src/remotion/styles.ts                             # Colores, fuentes compartidas
```

### Archivos modificados (3)

```
frontend/src/components/layout/sidebar.tsx        # Agregar ícono Guía
frontend/src/components/layout/bottom-nav.tsx      # Agregar ícono Guía
frontend/next.config.js                            # transpilePackages remotion
```

## Dependencias

```
remotion                # Core: useCurrentFrame, useVideoConfig, Sequence, etc.
@remotion/player        # <Player> embebible en React
```

**NO se instala:** `@remotion/renderer`, `@remotion/cli`, FFmpeg — no generamos MP4.

### Config Next.js

```js
// next.config.js
transpilePackages: ['remotion', '@remotion/player']
serverExternalPackages: ['@remotion/renderer']  // Prevención
```

## Datos mock

Archivo único `mock-data.ts` con datos ficticios:
- Tenant: "Distribuidora Demo"
- ~10 clientes inventados con nombres genéricos
- ~15 productos ficticios
- Predicciones de ejemplo por vertical
- Métricas simuladas

**Ningún dato real de IEY ni de ningún tenant.**

## Componentes de Remotion

### Wrappers (no refactorizamos producción)

Los componentes del dashboard hacen fetch a Supabase internamente. En vez de refactorizarlos, creamos wrappers simplificados dentro de `remotion/compositions/` que:
- Copian el JSX y estilos visuales
- Reciben datos mock por props directamente
- No tienen hooks de data fetching

### Componentes de anotación

- **`<Annotation>`** — Flechas SVG animadas con `interpolate()` de Remotion
- **`<TextOverlay>`** — Texto con fondo semi-transparente, fade in/out por frames
- **`<AnimatedCursor>`** — Círculo que se mueve con `spring()` simulando mouse

## Escalabilidad

### Agregar módulo nuevo (futuro)

1. Crear composiciones en `remotion/compositions/[modulo]/`
2. Agregar secciones en `guide-content.ts`
3. Agregar módulo en `guide-modules.ts` con `available: true`

No hay que tocar página ni layout — solo archivos de datos.

### Tipos

```ts
type GuideModule = {
  id: string
  name: string
  description: string
  icon: LucideIcon
  available: boolean
  sections: GuideSection[]
}

type GuideSection = {
  id: string
  title: string
  icon: LucideIcon
  description: string
  bullets: string[]
  route: string
  videoDurationFrames: number
}
```

## Seguridad

- Sin fetch a Supabase desde componentes Remotion
- Sin datos reales de tenants
- Sin secrets ni API keys involucradas
- Contenido puramente visual/estático

## Lo que NO se hace

- No se tocan componentes de producción del dashboard
- No se instala FFmpeg ni renderer
- No se pre-renderizan MP4
- No se graban screencasts manuales
