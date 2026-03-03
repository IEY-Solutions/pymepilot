# Handoff — Fase 9: Pulido y Produccion

**Fecha:** 2026-03-03
**Estado:** Pendiente de inicio
**Prerequisito:** Fases 0-8 completadas y auditadas (0C/0H en todas)
**Ultimo commit:** `a92e583` (docs: handoff auditoria fase 8)

---

## Contexto: donde estamos

PymePilot esta operativo para IEY. Las 8 fases del roadmap se completaron
en 13 dias (19 feb - 3 mar) vs las 20 semanas estimadas. Todas pasaron
auditoria de seguridad con resultado final 0C/0H.

### Lo que funciona hoy

| Componente | Estado | Detalle |
|------------|--------|---------|
| 4 verticales | Operativas | V1 Activacion, V2 Reposicion, V3 Cross-Sell, V4 Recuperacion |
| 3 canales ingesta | Operativos | API Contabilium, Smart Upload Excel, Google Drive |
| Dashboard | Desplegado | app.pymepilot.cloud (Next.js 16 + Supabase + Traefik) |
| Metricas | Operativas | 8 RPCs + 4 charts + ranking + exports (Excel + PDF) |
| WhatsApp | Parcial | Boton wa.me funciona. Notificacion diaria bloqueada por SIM chip. |
| Multi-tenant | Listo | Script onboarding + 12 tests aislamiento + VIEW segura |
| Automatizacion | **PARCIAL** | 4 de 5 cron jobs activos. **Orquestador comentado** (ver abajo). |

### ALERTA: Orquestador comentado en crontab

```bash
# ESTA LINEA ESTA COMENTADA:
#0 5 * * * flock -n /tmp/pymepilot-orchestrator.lock -c 'cd /home/pato/projects/pymepilot && backend/venv/bin/python backend/main.py' >> /home/pato/logs/orchestrator.log 2>&1
```

**Impacto:** El pipeline diario (sync ERP → atribucion → verticales) NO esta corriendo
automaticamente. Los datos de IEY no se actualizan solos.

**Accion requerida:** Descomentar la linea. Verificar que funciona antes de seguir con Fase 9.

### Crontab activo (4 de 5 jobs)

| Hora | Job | Estado |
|------|-----|--------|
| 0 3 | Backup PostgreSQL | Activo |
| * * | Upload worker (cada minuto) | Activo |
| 30 4 | Google Drive sync | Activo |
| ~~0 5~~ | ~~Orquestador (main.py)~~ | **COMENTADO** |
| 30 5 | Freshness check | Activo |

---

## Que dice el roadmap original sobre Fase 9

> **Duracion:** Semanas 21-22
> **Objetivo:** Sistema estable, monitoreado, seguro, y documentado.
>
> Tareas principales:
> - Monitoreo con Grafana: predicciones/dia, tokens consumidos, syncs exitosos/fallidos
> - Auditoria de seguridad completa
> - Optimizacion de rendimiento (queries lentas, indexes)
> - Documentacion final (arquitectura, API, operaciones)

---

## Infraestructura de monitoreo existente

Prometheus y Grafana ya estan desplegados en el Docker stack (`/opt/orion-stack/`),
pero **no estan integrados** con el backend Python ni con el frontend.

| Servicio | Version | Acceso | Estado |
|----------|---------|--------|--------|
| Prometheus | v3.9.1 | Puerto interno | Corriendo, sin metricas custom |
| Grafana | v12.3.1 | `https://${GRAFANA_DOMAIN}` | Corriendo, sin dashboards |

**Gap:** No hay instrumentacion. El backend no emite metricas a Prometheus.
Los logs van a archivo local (`backend/logs/pymepilot.log`), no a ningun
sistema centralizado.

---

## Deuda tecnica acumulada (MEDIUMs diferidos)

Estos items fueron identificados en auditorias de fases anteriores y diferidos
porque no bloqueaban. Fase 9 es el momento de resolverlos.

### Seguridad

| ID | Origen | Detalle | Impacto |
|----|--------|---------|---------|
| CORS | Fase 3 | Kong con `Access-Control-Allow-Origin: *` | Requiere root para editar kong.yml |
| EXCEPTION | Fase 7 | `EXCEPTION WHEN OTHERS` en `refresh_materialized_views` | Captura demasiado amplio, puede enmascarar errores |
| Cast | Fase 7 | `metadata->>'attribution_amount'::numeric` sin validacion | Podria fallar con datos no numericos |
| DoS | Fase 7 | Parametros int en RPCs sin limite superior | Menor: queries costosas con valores extremos |

### Calidad de codigo

| ID | Origen | Detalle |
|----|--------|---------|
| formatCurrency | Fase 7 | Duplicado en 7 archivos frontend |
| any types | Fase 7 | `any` en 4 CustomTooltip de charts (eslint-disable) |
| loading.tsx | Fase 7 | Sin loading propio para /metricas |
| customer norm | Fase 5 | Normalizacion duplicada en contactar |
| UNION ALL | Fase 7 | avg_co_purchase_rate puede ser impreciso en cross_sell_candidates |

---

## Archivos clave para Fase 9

### Monitoreo
- `/opt/orion-stack/docker-compose.yml` — Stack Docker (Prometheus, Grafana, etc.) **REQUIERE ROOT**
- `/opt/orion-stack/configs/prometheus/prometheus.yml` — Config Prometheus (minimal)
- `backend/engine/core/logger.py` — Logger actual (SanitizingFormatter, rotacion 7 dias)
- `backend/main.py` — Orquestador (punto de instrumentacion principal)

### Queries a optimizar
- `backend/engine/db/queries.py` — 13 queries SQL (candidatos de cada vertical)
- `database/migrations/026_cross_sell_kpis.sql` — MVs y RPCs
- `database/migrations/027_kpi_rpcs.sql` — RPCs de KPIs

### Frontend
- `frontend/src/app/(dashboard)/metricas/` — Charts y KPIs
- `frontend/src/components/predictions/` — Tarjetas de prediccion

### Documentacion existente
- `docs/PRD.md` — Producto (actualizado Fase 0)
- `docs/ROADMAP.md` — Plan original (no actualizado desde Fase 0)
- `docs/CONTABILIUM_API.md` — API ERP
- `docs/ONBOARDING.md` — Guia multi-tenant (Fase 8)
- `docs/handoffs/` — 29 handoffs de todas las fases
- `docs/plans/` — Design docs de fases 5-8

---

## Estadisticas del proyecto

### Codigo

| Area | Archivos | Migraciones |
|------|----------|-------------|
| Backend Python | ~25 archivos en `backend/` | — |
| Frontend Next.js | ~30 archivos en `frontend/src/` | — |
| Database | 31 migraciones + rollbacks | 001-031 |
| Tests SQL | 1 suite (12 tests aislamiento) | — |
| Scripts operativos | 12 scripts en `backend/scripts/` | — |

### Dependencias principales

| Python | Frontend |
|--------|----------|
| psycopg3 + pool | Next.js 16.1.6 |
| anthropic SDK | React 19.2.3 |
| pandas | Recharts 3.7 |
| cryptography (Fernet) | Supabase SSR |
| requests | shadcn/ui + Tailwind 4 |
| google-api-python-client | xlsx + react-pdf |

---

## Decisiones pendientes para Fase 9

Estas decisiones deben tomarse en la sesion de brainstorming/design:

1. **Monitoreo — alcance realista**
   - ¿Dashboards Grafana completos o metricas basicas con alertas por log?
   - ¿Instrumentar el backend Python (prometheus_client) o solo parsear logs?
   - Grafana y Prometheus requieren root. ¿Pato tiene acceso o necesitamos alternativa?

2. **Documentacion — que actualizar**
   - ROADMAP.md no se actualizo desde Fase 0 (dice "22 semanas")
   - ¿Crear doc de arquitectura final o los handoffs son suficientes?
   - ¿Actualizar PRD.md con resultados reales?

3. **Optimizacion — donde medir primero**
   - ¿Correr EXPLAIN ANALYZE en las queries de verticales?
   - ¿Hay quejas de lentitud en el dashboard?

4. **Deuda tecnica — priorizar**
   - ¿Resolver todos los MEDIUMs diferidos o solo los de seguridad?
   - CORS en Kong requiere root — ¿hay plan para eso?

5. **Orquestador — activar ya o como parte de Fase 9?**

---

## Proximo paso

Abrir sesion nueva → leer este handoff → brainstorming para definir alcance
de Fase 9 → design doc → implementacion → auditoria final.
