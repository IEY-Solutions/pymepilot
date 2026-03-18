# PymePilot — Estado del Proyecto

> **Archivo compartido entre Claude Code y Codex.**
> Ambas IAs deben leer este archivo al iniciar una sesion y actualizarlo
> al finalizar si hubo cambios relevantes en el estado del proyecto.
> Ultima actualizacion: 2026-03-18

---

## Que es PymePilot

Sistema de BI para distribuidores mayoristas B2B en Argentina.
Analiza datos del ERP para decir A QUIEN contactar, CUANDO, y QUE ofrecer.

**Cliente activo:** IEY (Distribuidor #1 MagSafe Argentina).
Resultados validados: facturacion recurrente 34%→74%, churn 18%→8%.

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

---

## En curso / pendiente

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
- Import fuera de orden en export-pdf.tsx (cosmetico)
- Rate delay ausente en path connector_override
- formatMonth duplicada en 5 archivos
- retryCount sin limite maximo en client-detail.tsx

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
- **4 Verticales:** V1 Activacion, V2 Reposicion (MVP), V3 Cross-Sell, V4 Recuperacion
- **Flujo datos:** ERP → PostgreSQL → Motor Python (5 AM) → predictions → Dashboard
- **DB user:** pymepilot_app (nosuperuser)
- **Tenant IEY:** `b815e5d6-2ef0-4d27-999b-8a7642b71183`

---

## Estructura del proyecto

```
pymepilot/
├── CLAUDE.md                  # Instrucciones para IAs (fuente de verdad)
├── AGENTS.md → CLAUDE.md      # Symlink para Codex
├── backend/engine/            # Motor Python (verticales, connectors, claude client)
├── backend/scripts/           # Scripts operativos (sync, run_vertical, etc.)
├── backend/config/            # Settings + prompts
├── database/migrations/       # 001-053 + rollbacks
├── frontend/                  # Next.js dashboard
├── docs/                      # PRD, ROADMAP, ARCHITECTURE, handoffs, plans
├── grafana/dashboards/        # 2 dashboards JSON
├── .claude/                   # Skills y agentes Claude Code
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
| `docs/ONBOARDING.md` | Guia para nuevos tenants |
| `docs/CONTABILIUM_API.md` | Referencia API Contabilium |
| `docs/CLAUDE_ORIGINS.md` | Contexto historico de reglas CLAUDE.md |

---

## Handoffs recientes

| Archivo | Tema |
|---------|------|
| `docs/handoffs/2026-03-18_cambio_credenciales_login_handoff.md` | Cambio seguro de credenciales de acceso |
| `docs/handoffs/2026-03-15_coexistencia_claude_codex.md` | Diseño coexistencia IAs |
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
- Leer `CLAUDE.md` completo para todas las reglas operativas.
