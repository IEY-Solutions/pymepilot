# Visión de Arquitectura: PymePilot como Plataforma Multi-Módulo

**Fecha:** 2026-03-04
**Estado:** Documento de visión (no requiere cambios inmediatos)
**Contexto:** MVP completado con módulo Predicciones. Se planifican módulos
adicionales (Cotizaciones, y más) bajo la misma plataforma.

---

## Visión de producto

PymePilot es el copiloto de la PyME. No es un producto aislado de
predicciones — es una plataforma que ofrece múltiples módulos de IA
aplicada a negocios.

Cada módulo resuelve un problema específico. El cliente se registra UNA
vez, activa los módulos que necesita, y paga UNA suscripción.

**Analogía:** Como un celular con apps. PymePilot es el celular,
Predicciones y Cotizaciones son las apps.

**Referente de negocio:** Odoo, HubSpot, Monday.com — una plataforma,
múltiples módulos, cada cliente activa lo que necesita.

---

## Módulos planificados

| Módulo | Target | Estado |
|--------|--------|--------|
| Predicciones (V1-V4) | Distribuidores B2B | MVP operativo (IEY) |
| Cotizaciones automáticas | Cualquier empresa que cotice | Próximo a desarrollar |
| (Futuros) | Por definir | Idea |

Nota: Cotizaciones tiene mercado más amplio que Predicciones (cualquier
empresa que haga cotizaciones, no solo distribuidores B2B).

---

## Decisión arquitectónica: Monorepo con módulos

**Opción elegida:** B — Monorepo con módulos dentro de PymePilot.
**Descartadas:** A (proyectos independientes), C (microservicios).

**Razón:** PymePilot es UNA plataforma. Los módulos comparten auth,
billing, conectores ERP, Claude client, DB, y dashboard. Separarlos
duplicaría todo eso. Un solo login, un solo dashboard, una sola factura.

---

## Estructura de carpetas

```
/home/pato/projects/pymepilot/          ← LA plataforma
│
├── backend/
│   ├── engine/
│   │   ├── core/                       ← compartido (logger, etc.)
│   │   ├── claude/                     ← compartido (Claude API client)
│   │   ├── connectors/                 ← compartido (ERP connectors)
│   │   ├── db/                         ← compartido (connection, queries base)
│   │   └── verticales/                 ← MODULO: Predicciones
│   │       ├── base.py
│   │       ├── reposicion.py
│   │       ├── activacion.py
│   │       ├── recuperacion.py
│   │       └── cross_sell.py
│   │
│   ├── modules/                        ← carpeta de módulos nuevos
│   │   └── cotizaciones/               ← MODULO: Cotizaciones
│   │       ├── __init__.py
│   │       ├── generator.py
│   │       ├── templates.py
│   │       └── queries.py
│   │
│   ├── config/prompts/                 ← prompts por módulo
│   │   ├── reposicion.txt
│   │   ├── activacion.txt
│   │   ├── recuperacion.txt
│   │   ├── cross_sell.txt
│   │   └── cotizacion.txt              ← futuro
│   │
│   ├── scripts/                        ← scripts compartidos
│   └── main.py                         ← orquestador (extender por módulo)
│
├── frontend/src/
│   ├── app/
│   │   ├── (auth)/                     ← compartido (login, signup)
│   │   └── (dashboard)/
│   │       ├── layout.tsx              ← sidebar DINAMICO
│   │       ├── contactar/              ← predicciones
│   │       ├── metricas/               ← predicciones
│   │       ├── historial/              ← predicciones
│   │       ├── cotizar/                ← cotizaciones (futuro)
│   │       │   ├── page.tsx
│   │       │   ├── nueva/
│   │       │   └── historial/
│   │       ├── datos/                  ← compartido
│   │       └── settings/               ← compartido (futuro)
│   │
│   ├── components/
│   │   ├── predictions/                ← componentes predicciones
│   │   ├── cotizaciones/               ← componentes cotizaciones (futuro)
│   │   ├── metrics/                    ← componentes métricas
│   │   └── ui/                         ← compartidos
│   │
│   └── lib/                            ← utilitarios compartidos
│
├── database/migrations/                ← TODAS juntas, numeradas
│   ├── 001-034                         ← predicciones + infra
│   ├── 035+                            ← cotizaciones (futuro)
│   └── rollbacks
│
├── grafana/dashboards/                 ← monitoreo compartido
├── docs/                               ← documentación compartida
└── AGENTS.md                           ← reglas compartidas
```

---

## Qué se comparte vs qué es por módulo

### Compartido (ya existe, se reutiliza)

| Componente | Ubicación | Qué hace |
|------------|-----------|----------|
| Auth | GoTrue + frontend (auth)/ | Login, signup, roles |
| DB + RLS | database/migrations/ | Multi-tenant, aislamiento |
| Claude client | backend/engine/claude/ | 4 capas de costos, retry |
| Conectores ERP | backend/engine/connectors/ | Contabilium, Excel, Smart Upload |
| Logger | backend/engine/core/ | SanitizingFormatter |
| Pool DB | backend/engine/db/ | psycopg3 + tenant context |
| Frontend layout | frontend/src/app/(dashboard)/layout.tsx | Sidebar, header |
| Utilidades | frontend/src/lib/ | formatCurrency, supabase client |
| Grafana | grafana/dashboards/ | Monitoreo operativo y costos |
| Crontab | 5 jobs | Backup, sync, orquestador |

### Por módulo (se crea nuevo para cada módulo)

| Componente | Ejemplo predicciones | Ejemplo cotizaciones |
|------------|---------------------|---------------------|
| Lógica de negocio | backend/engine/verticales/ | backend/modules/cotizaciones/ |
| Queries SQL | backend/engine/db/queries.py | backend/modules/cotizaciones/queries.py |
| Prompts | config/prompts/reposicion.txt | config/prompts/cotizacion.txt |
| Tablas DB | predictions, sync_log | quotes, quote_items (futuro) |
| Rutas frontend | /contactar, /metricas | /cotizar, /cotizar/nueva |
| Componentes UI | components/predictions/ | components/cotizaciones/ |

---

## Cómo se activan módulos por tenant

### Mecanismo (ya parcialmente existe)

La tabla `tenants` ya tiene `active_verticals` (JSONB). Se extiende:

```sql
-- Hoy:
active_verticals: ["reposicion", "activacion", "recuperacion", "cross_sell"]

-- Futuro: agregar campo active_modules
active_modules: ["predicciones", "cotizaciones"]
```

`active_verticals` sigue controlando qué verticales de predicción corren.
`active_modules` controla qué secciones del dashboard se muestran y qué
features están habilitadas.

### Frontend: sidebar dinámico

```typescript
// layout.tsx lee active_modules del tenant
const modules = tenant.active_modules; // ["predicciones", "cotizaciones"]

// Muestra solo las secciones que el tenant tiene activas
{modules.includes("predicciones") && <PrediccionesNav />}
{modules.includes("cotizaciones") && <CotizacionesNav />}
```

### Billing: planes definen módulos

| Plan | Módulos incluidos | Precio |
|------|-------------------|--------|
| Starter | 1 módulo a elección | $29/mes |
| Pro | Todos los módulos | $79/mes |
| Enterprise | Custom | Custom |

---

## Qué se necesita cambiar para el primer módulo nuevo

Cuando arranquemos Cotizaciones, los cambios son:

1. **Crear** `backend/modules/cotizaciones/` (lógica nueva)
2. **Crear** migraciones SQL (tablas quotes, quote_items, etc.)
3. **Crear** rutas frontend `/cotizar/`
4. **Crear** componentes `components/cotizaciones/`
5. **Agregar** `active_modules` al tenant (1 migración SQL)
6. **Modificar** `layout.tsx` para sidebar dinámico (1 archivo)
7. **Crear** prompt `config/prompts/cotizacion.txt`

**No se toca:** auth, billing, conectores, Claude client, DB pool, logger,
Grafana, crontab, ni ningún archivo existente del módulo Predicciones.

---

## Proceso para agregar un módulo nuevo (checklist)

1. **Brainstorming** — definir qué hace el módulo, para quién, qué datos necesita
2. **Design doc** — arquitectura, tablas, queries, prompts, pantallas
3. **Migraciones SQL** — tablas nuevas + rollback
4. **Backend** — lógica en `backend/modules/<nombre>/`
5. **Prompts** — en `backend/config/prompts/`
6. **Frontend** — rutas + componentes
7. **Sidebar dinámico** — si es el primer módulo nuevo, modificar layout.tsx
8. **Testing** — probar con IEY primero
9. **Auditoría** — 3 agentes, 0C/0H
10. **Activar** — agregar módulo a active_modules del tenant

---

## Referencias

- Análisis MVP a SaaS: `docs/plans/2026-03-04-mvp-to-saas-analysis.md`
- Arquitectura actual: `docs/ARCHITECTURE.md`
- PRD: `docs/PRD.md`
- Handoff Fase 9: `docs/handoffs/2026-03-04_fase9_audit_session.md`
