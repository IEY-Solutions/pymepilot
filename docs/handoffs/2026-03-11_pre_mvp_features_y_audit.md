# Handoff — Sesion 2026-03-11: Features completadas + Pre-MVP

## Resumen de sesion

### Features implementadas hoy

**Feature 2: PDF completo con identidad PymePilot** (commit ca13498)
- Reescritura total de `frontend/src/app/(dashboard)/metricas/exports/export-pdf.tsx`
- 3 paginas: KPIs + facturacion + churn/ticket, ranking clientes + productos, demanda por rubro + clientes
- Branding oscuro (#1a2a2c) con acentos teal (#81b5a1), footer con paginacion
- Se actualizó `metricas-content.tsx` para pasar todos los datos (sales, productRankings, demandProjections, clientDemand)

**Feature 4C: Actualizar chatbot** (commit ca13498)
- `backend/config/prompts/asesor_chat.txt` actualizado con:
  - 5 pestañas de metricas (Rendimiento, Clientes, Productos, Demanda, Comparar)
  - Demanda por producto (rubros) y por cliente (confianza 2+ compras)
  - Timers correctos del pipeline (3d/2d/3d)
  - PDF de 3 paginas con identidad PymePilot

**Propuesta de reposicion Excel** (commit a3e05e9)
- Nuevo: `frontend/src/lib/exports/export-proposal.ts` (usa exceljs)
- Boton "Generar propuesta" en `contact-modal.tsx` (solo vertical reposicion)
- Boton con gradiente teal + animacion shimmer al montar
- Excel con diseño: header teal, filas alternadas, columna "Por que te lo recomendamos" con fondo suave, total destacado
- Filtra solo SKUs con 2+ compras (alta confianza)
- Texto en segunda persona: "Compraste este articulo N veces. Tu ultima compra fue el DD/MM con X unidades."
- Design doc: `docs/plans/2026-03-11-propuesta-reposicion-excel-design.md`

### Dependencia nueva
- `exceljs` agregada a package.json (para estilos en Excel)

---

## Proxima sesion: Ultimos pasos antes del MVP

### Fuente
Tarea de Notion: "Ultimos pasos antes del mvp PymePilot" (Prioridad Alta, 2026-03-10)

### 5 pasos definidos

**Paso 1 — Auditoria general TOTAL de la aplicacion**
- NO solo seguridad: revisar TODO — código, UX, consistencia, performance, edge cases, tipos, errores sin manejar, imports no usados, logica de negocio, flujos rotos, mobile responsiveness
- Es la auditoria pre-lanzamiento: lo que no se detecte ahora llega al usuario final
- Cubrir: frontend (Next.js), backend (Python), database (RPCs, migraciones, RLS), infraestructura (Docker, crons)
- Auditorias previas: Fase 9 (R24, R25) — 0C/0H pendientes. MEDIUMs diferidos listados en MEMORY.md

**Paso 2 — Auditoria especifica de API/conectores**
- Foco en `backend/engine/connectors/` (contabilium.py, sync.py, base.py, crypto.py)
- Verificar robustez post-incidente (hotfix 2026-03-07/08, fases A+B+C)
- Rate limiting, retry logic, error handling, logging
- `env_guard.py` y `cron_wrapper.py` (nuevos del hotfix)
- Objetivo: estar 100% listos para cuando Contabilium responda el ticket

**Paso 3 — Reconexion segura con Contabilium** (bloqueado por ticket)
- Requiere que Contabilium resuelva la inaccesibilidad para 3 usuarios IEY
- Ticket abierto en Jira Service Management (2026-03-07)
- Cuando se resuelva: reconectar API respetando rate limits (25 req/10s oficial, nosotros usamos ~5 req/10s)

**Paso 4 — Sync manual incremental** (bloqueado por paso 3)
- Solo sincronizar datos nuevos desde ultimo sync exitoso
- Respetar SYNC_RATE_LIMIT_DELAY=2.0s y batch pacing (10s cada 20 requests)
- Max 1 sync API/dia/tenant (bypass con --force)
- Techo diario: 5000 registros

**Paso 5 — Sync de stock de deposito** (bloqueado por paso 3)
- Nueva feature: conectar con inventario de "deposito" en Contabilium
- Objetivo: la propuesta de reposicion (Excel) valide existencias antes de recomendar
- Requiere investigar endpoints de stock en API Contabilium
- Requiere ticket de Contabilium resuelto

### Orden sugerido
1. Auditoria general (paso 1) — se puede hacer AHORA
2. Auditoria API (paso 2) — se puede hacer AHORA
3. Pasos 3-4-5 — cuando Contabilium responda el ticket

### Archivos clave para la auditoria
- Frontend: `frontend/src/` (App Router, componentes, exports)
- Backend: `backend/engine/` (conectores, verticales, claude client, DB)
- Database: `database/migrations/` (001-051)
- Infra: crontab, Docker, deploy.sh
- Docs: `docs/ARCHITECTURE.md`, `docs/PRD.md`
- Config: `backend/config/settings.py`, `backend/config/prompts/`
- Auditorias previas: `docs/handoffs/2026-03-08_hotfix_implementacion_fases_abc.md`
- MEDIUMs diferidos: ver seccion en MEMORY.md

### Crontab actual (PARCIALMENTE DESACTIVADO desde 2026-03-07)
```
0 3 * * *   backup PostgreSQL                       # ACTIVO
30 5 * * *  freshness check                          # ACTIVO
# Todo lo demas DESACTIVADO hasta resolver ticket Contabilium
```
