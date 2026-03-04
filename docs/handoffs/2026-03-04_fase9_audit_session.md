# Handoff: Fase 9 — Auditoría Final (Bloque 7)

**Fecha:** 2026-03-04
**Sesión:** Auditoría de seguridad + fixes
**Siguiente:** Fase 10 — Mejoras IEY y refinamiento

---

## Resumen

Se ejecutó la auditoría final de Fase 9 con 3 agentes (@security-guardian,
@db-architect, @nextjs-dashboard) sobre los 17 archivos nuevos/modificados
en Bloques 1-6.

**Ronda 1:** 0 CRITICAL, 0 HIGH, 7 MEDIUM, 7 LOW
**Fixes aplicados:** 4 MEDIUMs de seguridad (migration 034 + format.ts)
**Ronda 2:** 4/4 verificados, 0 regresiones, 0 nuevos — APROBADO

---

## Commit de esta sesión

| Commit | Descripción |
|--------|-------------|
| `4a18ae9` | fix: fase 9 bloque 7 — auditoría final (4 fixes seguridad) |

---

## Fixes aplicados (Migration 034)

| ID | Fix | Detalle |
|----|-----|---------|
| M-01 | SET search_path en refresh_materialized_views | SECURITY DEFINER con search_path fijo + REVOKE PUBLIC + GRANT pymepilot_app |
| M-02 | Regex mejorado en get_monthly_value | `^\d+\.?\d*$` → `^\d+(\.\d+)?$` (rechaza "." suelto) |
| M-03 | GREATEST como piso en 6 RPCs | `LEAST(GREATEST(p_months, 1), 24)` — 8 ocurrencias en 6 funciones |
| M-05 | formatCurrency edge cases | Maneja negativos (`-$5k`), NaN e Infinity (`$0`) |

**Archivos creados:**
- `database/migrations/034_audit_security_hardening.sql`
- `database/migrations/034_rollback.sql`

**Archivos modificados:**
- `frontend/src/lib/format.ts`

**Backup pre-migration:** `postgres_backup_20260304_013244.sql.gz`

---

## MEDIUMs diferidos (no bloquean, no son de seguridad)

| ID | Descripción | Razón |
|----|-------------|-------|
| M-04 | Rollback 033 sin GRANT EXECUTE explícitos | PostgreSQL preserva GRANTs en CREATE OR REPLACE |
| M-06 | `any` residual en payload.map de revenue-chart y ticket-chart | Recharts define payload como ReadonlyArray\<any\> |
| M-07 | Import de formatCurrency fuera de orden en export-pdf.tsx | Cosmético, funciona por hoisting ESM |

## LOWs documentados (mejoras menores)

| ID | Descripción |
|----|-------------|
| L-01 | monitoring_syncs expone `source` cross-tenant (grafana_reader es interno) |
| L-02 | jsonb_array_length(errors) sin COALESCE para NULL |
| L-03 | EXTRACT(EPOCH FROM ...) retorna NULL si completed_at es NULL |
| L-04 | export-excel.ts no usa formatCurrency centralizado (intencional: Excel necesita valores completos) |
| L-05 | formatMonth duplicada en 5 archivos (candidata a centralizar) |
| L-06 | retryCount en ClientDetail sin límite máximo |
| L-07 | Tooltips y YAxis usan formatos distintos (completo vs compacto) |

---

## Estado final: Todas las fases completadas

| Fase | Estado | Auditoría |
|------|--------|-----------|
| 0. Setup infraestructura | COMPLETADA | — |
| 1. Ingesta ERP (Contabilium) | COMPLETADA | 0C/0H |
| 2. Motor Claude + costos | COMPLETADA | 0C/0H |
| 3. Dashboard MVP | COMPLETADA | 0C/0H |
| 4. Orquestador 5 AM | COMPLETADA | 0C/0H |
| 5. V1 Activación + V4 Recuperación | COMPLETADA | 0C/0H |
| 6. WhatsApp (Parte 1 botón wa.me) | COMPLETADA | — |
| 7. V3 Cross-Sell + /metricas | COMPLETADA | 0C/0H |
| 8. Multi-tenant productivo | COMPLETADA | 0C/0H |
| 9. Pulido y producción | COMPLETADA | 0C/0H |

**Duración total: 13 días (2026-02-19 → 2026-03-04)**

---

## Para la próxima sesión: Fase 10 — Mejoras IEY

### Contexto

El MVP está completo y corriendo en producción para IEY. La Fase 10 se
enfoca en profundizar con el único tenant activo: mejorar la calidad de
las predicciones, completar features pendientes, y refinar el producto
basándose en uso real.

### Backlog sugerido (priorizado)

**P0 — Pendientes bloqueados que se desbloquearon o están próximos:**
1. **WhatsApp Cloud API (Fase 6 Parte 2):** Notificación diaria automática
   al vendedor. Bloqueado por SIM chip — verificar si Pato ya lo tiene.
2. **Atribución automática:** Hoy las predicciones se marcan "completadas"
   manualmente. Automatizar: si el cliente compró dentro de la ventana de
   predicción, marcar como convertida y registrar attribution_amount.

**P1 — Mejoras de calidad basadas en datos reales:**
3. **Afinación de prompts:** Revisar mensajes generados para IEY. ¿Suenan
   naturales? ¿El vendedor los usa tal cual o los reescribe? Ajustar
   prompts basándose en feedback real.
4. **Precisión de predicciones:** Analizar hit rate de V2 (reposición) con
   datos acumulados. ¿Los clientes que predijimos que necesitaban reposición
   efectivamente compraron? Ajustar factores de scoring si es necesario.
5. **Ventanas de predicción:** Revisar si los 14 días de V2, 7/15/25 de V1,
   y 60/90/120 de V4 son óptimos para el patrón de compra de IEY.

**P2 — Mejoras de UX del dashboard:**
6. **Filtro por fecha en /contactar:** Hoy muestra ventana fija de 3 días.
   Agregar selector de rango.
7. **Estado de predicciones:** Botón para marcar "contactado" → "vendido"
   directamente desde el dashboard (hoy solo "contactado").
8. **Notificaciones in-app:** Badge con cantidad de predicciones nuevas
   desde la última visita.

**P3 — Deuda técnica menor (LOWs de auditorías):**
9. Centralizar formatMonth (L-05, 5 copias)
10. COALESCE en jsonb_array_length (L-02)
11. Límite en retryCount de ClientDetail (L-06)

### Datos útiles para la próxima sesión

- **IEY tenant_id:** `b815e5d6-2ef0-4d27-999b-8a7642b71183`
- **Clientes IEY:** ~165 (post-dedup)
- **Verticales activas:** reposicion, activacion, recuperacion, cross_sell
- **Último run del orquestador:** verificar con `SELECT * FROM orchestrator_runs ORDER BY started_at DESC LIMIT 1;`
- **Predicciones acumuladas:** verificar con `SELECT vertical, status, COUNT(*) FROM predictions GROUP BY vertical, status ORDER BY vertical;`
- **Costo acumulado Claude:** verificar con `SELECT SUM(cost_usd) FROM api_usage;`

### Dependencias externas

- **SIM chip para WhatsApp Cloud API:** ¿Pato ya lo consiguió?
- **Feedback de vendedores IEY:** ¿Están usando los mensajes? ¿Qué dicen?
- **Datos frescos:** ¿El orquestador corrió OK desde que se activó el crontab?
