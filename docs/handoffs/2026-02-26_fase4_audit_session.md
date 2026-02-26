# Handoff: Auditoría Fase 4 + Cierre

**Fecha:** 2026-02-26
**Sesion:** Auditoría de seguridad Fase 4 + corrección de hallazgos HIGH
**Commits:** `50b5c61` (5 fixes HIGH)

---

## Que se hizo

### Auditoría con 4 agentes en paralelo

| Agente | Scope | Resultado |
|---|---|---|
| @security-guardian | Secrets, SQL injection, multi-tenant, costos Claude | 0C, 0H, 2M, 4L, 3I |
| @db-architect | Migración 024, RLS, permisos, queries | 0C, 0H, 2M, 3L, 5I |
| @python-engine | Error handling, pool, concurrencia, código | 0C, 4H, 6M, 5L, 3I |
| @nextjs-dashboard | Data fetching, XSS, timezone, responsive | 0C, 1H, 3M, 2L |

**Consolidado deduplicado: 0 CRITICAL, 5 HIGH, 11 MEDIUM, 10 LOW**

### 5 HIGH corregidos

| # | Hallazgo | Fix | Archivo |
|---|----------|-----|---------|
| H-01 | Sin protección contra ejecución concurrente del cron | `flock -n` en crontab | crontab |
| H-02 | VERTICAL_REGISTRY duplicado en main.py y run_vertical.py | Módulo compartido | backend/engine/verticales/__init__.py |
| H-03 | Vertical hardcodeada 'reposicion' en queries atribución/resumen | Parámetro `vertical` con default | backend/engine/db/queries.py |
| H-04 | run_vertical.py no cierra pool de conexiones | `finally: close_pool()` | backend/scripts/run_vertical.py |
| F4-01 | Timezone mismatch en filtro de predicciones del dashboard | `ENV TZ=America/Argentina/Buenos_Aires` | frontend/Dockerfile |

### Estado post-auditoría: 0C / 0H

---

## Hallazgos MEDIUM pendientes (backlog)

| # | Hallazgo | Cuándo resolver |
|---|----------|-----------------|
| M-01 | orchestrator_runs expone datos cross-tenant via PostgREST | Pre segundo tenant |
| M-02 | ValueError sin sanitize_text en _run_verticals | Próxima sesión código |
| M-03 | Sin CHECK constraint en active_verticals JSONB | Pre UI de configuración |
| M-04 | Sin REVOKE DELETE/TRUNCATE explícito en migración 024 | Migración 025 |
| M-05 | Sin manejo de SIGTERM/SIGINT en orquestador | Pre producción multitenants |
| M-06 | _calculate_factors() se llama dos veces por candidato | Optimización |
| M-07 | _process_candidate retorna dict/str/None — tipo frágil | Refactor verticales |
| M-08 | Cada candidato abre su propia conexión del pool | Optimización |
| M-09 | Resumen final usa print() en vez de logger | Próxima sesión código |
| M-10 | Tarjeta oculta cuando hay 0 predicciones — sin estado informativo | Fase 5 dashboard |
| M-11 | Status del orquestador sin mapeo a texto amigable | Fase 5 dashboard |

---

## Estado completo de fases

| Fase | Estado | Auditoría |
|---|---|---|
| Fase 0 | COMPLETADA | N/A (fundación) |
| Fase 1 | COMPLETADA | AUDITADA 0C/0H |
| Fase 2 (Motor) | COMPLETADA | AUDITADA 0C/0H |
| Fase 3 (Dashboard) | COMPLETADA | AUDITADA 0C/0H |
| Smart File Upload | COMPLETADO | Cubierto en audit Ingesta |
| Ingesta Fase 2 | COMPLETADA | AUDITADA 0C/0H |
| **Fase 4 (Automatización)** | **COMPLETADA** | **AUDITADA 0C/0H** |

**HITO MVP ALCANZADO:** El sistema funciona para IEY sin intervención manual.
Cada mañana a las 5 AM: sync → atribución → predicciones → dashboard listo.

**25 migraciones ejecutadas** (001-024 + rollbacks)

---

## Pendiente no-bloqueante

- **Rebuild frontend:** `docker compose build --no-cache frontend-dashboard` para que tome TZ. No crítico (solo afecta 21:00-23:59).
- **Candidatos duplicados:** 17/32 UniqueViolation en segunda ejecución accidental. Desperdicia ~$0.085/corrida. Investigar query de candidatos.
- **Indexes redundantes:** idx_customers_external_id, idx_orders_external_id (deferred desde Fase 1).

---

## Crontab actual (5 jobs)

```
0 3 * * *   backup PostgreSQL
* * * * *   upload worker (process_uploads.py)
30 4 * * *  Google Drive sync
0 5 * * *   ★ ORQUESTADOR con flock ★
30 5 * * *  freshness check
```

---

## Próxima fase: Fase 5 — Verticales 1 y 4

Según `docs/ROADMAP.md` (Semanas 10-12):

1. **V1 Activación Clientes Nuevos** — secuencia día 7/15/25 post primera compra
2. **V4 Recuperación Inactivos** — ventanas 60/90/120 días sin comprar
3. **Vistas dashboard** por vertical
4. **Vista unificada** "Todas las acciones de hoy" (V1 + V2 + V4)
5. Testing con datos reales de IEY

**Ventaja:** La arquitectura ya soporta múltiples verticales:
- `VERTICAL_REGISTRY` centralizado (fix H-02 de hoy)
- `active_verticals` JSONB por tenant en DB
- `VerticalBase` como Template Method
- Orquestador itera sobre verticales activas
- Queries parametrizadas por vertical (fix H-03 de hoy)

Solo hay que crear las clases Python (V1, V4), sus prompts, y las vistas frontend.

---

## Prompt para iniciar sesión nueva

```
Lee el handoff en docs/handoffs/2026-02-26_fase4_audit_session.md.

Fase 4 COMPLETADA + AUDITADA (0C/0H). Hito MVP alcanzado.
Orquestador con flock corriendo a las 5 AM.
32 predicciones reales generadas para IEY.

Próxima tarea: Fase 5 — Verticales V1 (Activación) y V4 (Recuperación).
Ver docs/ROADMAP.md sección Fase 5 y docs/PRD.md para lógica de negocio.
```
