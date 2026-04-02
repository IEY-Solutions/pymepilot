# PymePilot — Estado del Proyecto

> **Archivo compartido entre sesiones de Codex.**
> Leer este archivo al iniciar una sesion y actualizarlo al finalizar si
> hubo cambios relevantes en el estado del proyecto.
> Ultima actualizacion: 2026-04-02

---

## Que es PymePilot

Sistema de seguimiento pre y post venta + fidelizacion inteligente via WhatsApp + Claude AI.
Ocupa el unico espacio vacio del ciclo comercial: la etapa entre el cierre de una venta y la proxima compra.
Escala progresivamente de mercados mayoristas a minoristas y servicios.

**En una linea:** PYMEPILOT convierte cada venta en el inicio de una relacion, no en el fin de una transaccion.

**Cliente activo:** IEY (Distribuidor #1 MagSafe Argentina).
IEY es el tenant de validacion activo, no la plantilla del producto. Toda logica compartida de PymePilot debe seguir siendo reusable, configurable por tenant y lista para escalar a multiples clientes.
Resultados validados: facturacion recurrente 34%→74%, churn 18%→8%.

**Modelo de negocio:** fee base + rev share sobre ventas recuperadas atribuibles.

**Pack de reconstruccion:** `docs/reconstruction/README.md`
si vas a rehacer el sistema en otro repo. Ese pack concentra el mapa del
sistema, contratos tecnicos, modulos, operacion, base de datos y decisiones
que no conviene perder.

**Escalera de mercado:**
- HOY: Distribuidoras mayoristas Argentina (~8.000 empresas)
- Mes 6-12: B2B similares (ferreterias, alimentos)
- Año 2: Minorista Tipo A (servicios con turnos)
- Año 3+: Minorista Tipo B/C + LATAM

---

## Estado general

**MVP COMPLETADO** — Fases 0-9 finalizadas en 13 dias (2026-02-19 → 2026-03-04).
Sistema funciona para IEY sin intervencion manual.

| Fase | Estado | Fecha | Resumen |
|------|--------|-------|---------|
| 0 | DONE | 2026-02-19 | Setup inicial |
| 1 | DONE + AUDITADA | 2026-02-26 | Sync ERP (Contabilium + Excel) |
| 2 | DONE + AUDITADA | 2026-02-22 | Motor Claude + 4 capas costos |
| 3 | DONE + AUDITADA | 2026-02-26 | Dashboard MVP en app.pymepilot.cloud |
| 4 | DONE + AUDITADA | 2026-02-26 | Orquestador 5AM con flock |
| 5 | DONE + AUDITADA | 2026-02-26 | V1+V4 verticales |
| 6 | Parte 1 DONE | 2026-02-27 | Boton wa.me (Parte 2 bloqueada: SIM chip) |
| 7 | DONE + AUDITADA | 2026-02-28 | V3 Cross-Sell + /metricas |
| 8 | DONE + AUDITADA | 2026-03-03 | Multi-tenant productivo |
| 9 | DONE + AUDITADA | 2026-03-04 | Grafana, seguridad, calidad, docs |

**Fase actual:** 10 — Mejoras IEY y refinamiento

---

## Fase 10 — Features completadas

| Feature | Fecha | Detalle |
|---------|-------|---------|
| Brainstorming backlog | 2026-03-08 | 7 features analizadas, 4 design docs |
| Tooltips UI | 2026-03-08 | 28 tooltips en 6 paginas |
| Chatbot IA | 2026-03-08 | PymePilot Asesor, 13 tools, Claude tool use |
| Pipeline CRM | 2026-03-08/10 | Kanban 6 cols, drag & drop, followups, 4 sesiones |
| Dashboard Metricas | 2026-03-10 | Comparar periodos, ranking productos, top 10 |
| Auditoria Pre-MVP | 2026-03-11 | 3C+15H+4M corregidos, reconexion Contabilium |
| Hotfix Contabilium | 2026-03-07/08 | 14 de 15 fixes, env_guard, cron_wrapper |
| Branding UI | 2026-03-19 | Favicon PymePilot productivo + logo integrado en login y header |
| Cuentas Clave | 2026-03-19 | Key Account Management: 3 tablas + 3 RPCs, grilla con semaforo, detalle 7 bloques, notas con acciones, alertas, nudge seguimiento |
| Metodologia libre Codex | 2026-03-20 | Config global ajustada para sesiones nuevas con `approval_policy=never` y `sandbox_mode=danger-full-access` (Full Access por defecto), manteniendo denylist global en `~/.codex/rules/default.rules` con 41 bloqueos de alto riesgo para Docker/SO/PostgreSQL/Git/Crons/secrets. Override PymePilot alineado con worktrees proactivos. Hotfix Linux sandbox en este VPS: `features.use_linux_sandbox_bwrap=false` + `features.use_legacy_landlock=true` para evitar el fallo `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` y restaurar ejecucion normal |
| Manuales operativos Codex | 2026-04-02 | Reescritura elite de `C:\\Users\\Admin\\.codex\\AGENTS.md` y `AGENTS.md` del repo como fuente activa de instrucciones. `CLAUDE.md` queda como nota historica de compatibilidad y sus prioridades operativas utiles fueron fusionadas en ambos manuales |
| Linear MCP first | 2026-04-02 | `AGENTS.md` global y del repo reforzados para que Codex use Linear por MCP como sistema operativo real: buscar y reutilizar issues/proyectos, crear artifacts automaticamente cuando no existan, dejar bundles documentales fijos, leer el `PYM-*` o proyecto antes de trabajar y mantener comentarios o status updates mientras avanza |
| Anti-overfitting multi-cliente | 2026-04-02 | `AGENTS.md` global, `AGENTS.md` del repo y resources activos de Linear reforzados para prohibir logica acoplada a IEY. IEY queda como tenant de validacion, no como plantilla del producto; cualquier necesidad especifica de cliente debe aislarse en configuracion, mappings, prompts parametrizados o adapters por tenant |
| Guia Onboarding | 2026-03-19 | /guia con Remotion Player embebido, 7 composiciones con wrappers visuales + cursor + highlights + text overlay, datos mock "Distribuidora Demo", IntersectionObserver autoplay, selector de modulos escalable |
| **Auditoria Post-MVP** | **2026-03-20** | **1C + 5H + 12M + 8L corregidos. 5 agentes especializados + 4 rondas revision Codex. Commit 48210ea. Migracion 056 pendiente aplicar en DB.** |
| Orquestador refresh post-sync | 2026-03-20 | Se agrego suite `backend/tests/test_main_orchestrator.py` y se reordeno `backend/main.py` a 2 fases: sync de todos los tenants primero, refresh unico de vistas materializadas despues, y recien ahi atribucion + verticales + push. Fix permanente para que `/metricas` y `client_rankings` muestren ventas del mismo dia en vez de la foto del dia anterior |
| Reestructuracion multi-modulo verificada | 2026-03-21 | Renombre `backend/engine/verticales/` → `backend/engine/seguimiento/` verificado sin referencias viejas. Se corrigio bug de atribucion en `backend/engine/db/queries.py` agregando casts explicitos para `jsonb_build_object()` compatibles con psycopg 3, con test de regresion `backend/tests/test_db_queries.py`. Migracion `057_platform_modules.sql` corregida para PostgreSQL real y aplicada en produccion: `tenants.segment='mayorista'`, `tenants.active_modules={'seguimiento'}` y constraints creados OK |
| Estructura modular minima | 2026-03-21 | Prompts del modulo `seguimiento` reorganizados en `backend/config/prompts/seguimiento/` con fallback legacy en `VerticalBase`. Navegacion del frontend extraida a `frontend/src/lib/products/` para representar `PymePilot Mayoristas` como producto actual. Documentacion nueva: `docs/modules/` y plan de evolucion por segmentos en `docs/plans/2026-03-21-estructura-modular-segmentos-design.md` |

---

## En curso / pendiente

### Operativo
- **Cambio de credenciales login IEY:** el 2026-03-18 se detecto que
  `create_tenant.py` fallaba con `401 Invalid authentication credentials`
  via `Kong` en `/auth/v1/admin/users`, aunque el mismo service-role JWT
  era aceptado por GoTrue directo. Se agrego fallback automatico a Auth
  directo del contenedor para endpoints admin. Ademas, se corrigio el
  falso negativo del Paso 5 que contaba `user_profiles` sin tenant context
  y RLS devolvia `0` aunque existieran perfiles. Cobertura agregada en
  `backend/tests/test_create_tenant_auth_fallback.py`.

### Diseños aprobados
- **Centro de monitoreo Grafana:** design aprobado el 2026-03-18.
  Enfoque elegido: integrar sobre el Grafana actual sin romperlo,
  y dejar dashboard principal + documentacion versionados en repo.
- **Infra monitoreo host/containers:** `node-exporter` + `cadvisor`
  activados en Prometheus el 2026-03-18. Targets verificados `up`.
- **Dashboard versionado:** `grafana/dashboards/pymepilot-centro-monitoreo.json`
  creado e importado en Grafana el 2026-03-18. Datasources mapeados
  y panel principal verificado funcionando.
- **Servicios criticos monitoreados:** `blackbox-exporter` agregado el
  2026-03-18 con probes reales para `Postgres`, `Kong/API`, `Auth`,
  `Grafana` y `App PymePilot`. Probes verificados `up` y dashboard
  principal actualizado para mostrarlos en una fila dedicada.
- **Roadmap modular operativo:** vive en Notion como tarea
  `Roadmap modular — cotizaciones y portal`
  (`https://www.notion.so/32a63ade414e81bca4efd03c624b15a4`).
  No esta duplicado en el repo; el repo solo conserva el documento
  de diseño `docs/plans/2026-03-21-estructura-modular-segmentos-design.md`.
### Bloqueados
- **WhatsApp Cloud API (Fase 6 Parte 2):** requiere SIM chip fisico
- **Sync stock deposito:** requiere ticket Contabilium (pendiente respuesta)

### Crons (parcialmente desactivados desde 2026-03-07)
```
0 3 * * *   backup PostgreSQL                       # ACTIVO
30 5 * * *  freshness check                          # ACTIVO
#DISABLED#  upload worker (process_uploads.py)       # DESACTIVADO
#DISABLED#  Google Drive sync                        # DESACTIVADO
#DISABLED#  ORQUESTADOR con flock                    # DESACTIVADO
```
Reactivacion pendiente (ticket Contabilium).

### Backlog P0-P3
- **P0:** WhatsApp Cloud API (bloqueado), Atribucion automatica
- **P1:** Afinacion prompts, precision predicciones, ventanas optimas
- **P2:** Filtro fecha /contactar, estado vendido, notificaciones in-app
- **P3:** Deuda tecnica menor (LOWs acumulados)

### MEDIUMs diferidos (no bloquean)
- Customer duplicada en contactar (cleanup menor)
- `any` residual en Recharts payload (limitacion libreria)
- retryCount sin limite maximo en client-detail.tsx
- (Los items "Rate delay ausente", "formatMonth duplicada", "Import export-pdf" fueron resueltos en auditoria 2026-03-20)

### Accion pendiente — CRITICA
- **Aplicar migración 056 en DB de producción:**
  ```bash
  docker cp database/migrations/056_audit_security_fixes.sql orion-menteax_postgres:/tmp/
  docker exec orion-menteax_postgres psql -U postgres -d orion_db -f /tmp/056_audit_security_fixes.sql
  ```
  Esta migración corrige el CRITICAL C-01 (tenant isolation en KPI RPCs).
  Sin ella, el código está en main pero la DB sigue vulnerable.

---

## Stack tecnico

- **Frontend:** Next.js 14+ (App Router, TypeScript strict, Tailwind + shadcn/ui)
- **Backend:** Supabase self-hosted (PostgreSQL 15+, GoTrue, PostgREST, RLS) + Traefik
- **Motor IA:** Python 3.11+ (psycopg3, Anthropic Claude API, Pandas)
- **ERPs:** Contabilium API REST, Excel/CSV (fallback)
- **Infra:** Contabo VPS 12GB RAM, Docker + Docker Compose
- **Monitoreo:** Grafana + Prometheus

## Arquitectura clave

- **Multi-tenant:** tenant_id + RLS + FORCE RLS (NO schema-per-tenant)
- **Canal principal:** WhatsApp Business API directa (no Kommo)
- **Flujo datos:** ERP → PostgreSQL → Motor Python (5 AM) → predictions → WhatsApp → Dashboard
- **DB user:** pymepilot_app (nosuperuser)
- **Tenant IEY:** `b815e5d6-2ef0-4d27-999b-8a7642b71183`

### 4 Pilares del producto

| Pilar | Descripcion | Estado |
|-------|-------------|--------|
| 1 — Orquestador Proactivo | Corre 5am, detecta inactivos, genera mensajes Claude AI, envia por WhatsApp | En produccion |
| 2 — Webhooks + Analisis Reactivo | Recibe respuestas en tiempo real, Claude analiza intencion/emocion/objeciones | En desarrollo |
| 3 — Multi-Agente | Agente Respondedor (conversacional) + Agente Analista (estrategico) en paralelo | Fase siguiente |
| 4 — Embedded Signup | Cliente conecta su propio WhatsApp Business desde el dashboard sin ayuda | Mes 3+ |

### Verticales tecnicas (codigo)

V1 Activacion + V2 Reposicion + V3 Cross-Sell + V4 Recuperacion.
Estos son los nombres tecnicos en el codigo. El marco de negocio actual los agrupa como "features de fidelizacion" (F1-F5).

---

## Estructura del proyecto

```
pymepilot/
├── AGENTS.md                  # Instrucciones para IAs (fuente de verdad)
├── backend/engine/            # Motor Python (seguimiento, connectors, claude client)
├── backend/scripts/           # Scripts operativos (sync, run_vertical, etc.)
├── backend/config/            # Settings + prompts
├── database/migrations/       # 001-057 + rollbacks
├── frontend/                  # Next.js dashboard
├── docs/                      # PRD, ROADMAP, ARCHITECTURE, handoffs, plans
├── grafana/dashboards/        # 2 dashboards JSON
├── .agents/                   # Skills Codex
└── .codex/                    # Config Codex
```

---

## Documentacion clave

| Archivo | Contenido |
|---------|-----------|
| `docs/PRD.md` | Product Requirements Document |
| `docs/ROADMAP.md` | Roadmap v2 con fechas reales |
| `docs/ARCHITECTURE.md` | Arquitectura completa |
| `docs/modules/` | Documentacion funcional por modulo |
| `docs/ONBOARDING.md` | Guia para nuevos tenants |
| `docs/CONTABILIUM_API.md` | Referencia API Contabilium |

---

## Handoffs recientes

| Archivo | Tema |
|---------|------|
| `docs/handoffs/2026-03-21_reestructuracion_multi_modulo.md` | Reestructuracion multi-modulo + verificacion + actualizacion minima |
| `docs/handoffs/2026-03-19_branding_ui_handoff.md` | Branding inicial frontend + favicon + lockup login/header |
| `docs/handoffs/2026-03-18_cambio_credenciales_login_handoff.md` | Cambio seguro de credenciales de acceso |
| `docs/handoffs/2026-03-11_auditoria_pre_mvp_sesion2.md` | Auditoria pre-MVP paso 2 |
| `docs/handoffs/2026-03-10_dashboard_metricas_mejoras.md` | Mejoras dashboard metricas |
| `docs/handoffs/2026-03-10_pipeline_crm_sesion4.md` | Pipeline CRM sesion 4 |
| `docs/handoffs/2026-03-09_pipeline_crm_sesion3.md` | Pipeline CRM sesion 3 |
| `docs/handoffs/2026-03-08_hotfix_implementacion_fases_abc.md` | Hotfix Contabilium |

---

## Notas para IAs

- **Modo educativo:** Pato esta aprendiendo a programar. Explicar QUE, POR QUE, y QUE concepto involucra.
- **Seguridad primero:** Nunca leer .env, nunca exponer secrets, siempre RLS con tenant_id.
- **Regla de las Dos Opciones:** Ante cualquier decision, presentar al menos 2 opciones con pros/contras.
- **Context7 MCP:** Consultar documentacion actualizada antes de escribir codigo con librerias externas.
- **Vistas materializadas:** Si se hace sync sin orquestador, recordar `SELECT public.refresh_materialized_views()`.
- Leer `AGENTS.md` completo para todas las reglas operativas.
