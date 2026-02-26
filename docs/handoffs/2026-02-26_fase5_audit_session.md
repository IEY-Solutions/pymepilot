# Handoff: Auditoria Fase 5 — V1 Activacion + V4 Recuperacion

**Fecha:** 2026-02-26
**Sesion:** Auditoria de seguridad Fase 5 (2 rondas) + correccion de hallazgos HIGH
**Commits:** `ddd4226` (implementacion), `ab6b1ba` (4 fixes HIGH)

---

## Que se hizo

### Ronda 1 — Auditoria con 4 agentes en paralelo

| Agente | Scope | Resultado |
|---|---|---|
| @security-guardian | SQL injection, tenant isolation, secrets, costos Claude, XSS | 0C, 0H, 2M, 3L, 2I |
| @db-architect | Queries V1/V4, indices, performance, ventanas, dedup | 0C, 1H, 3M, 4L, 3I |
| @python-engine | Template Method, classify_profile, factores, prompts, robustez | 0C, 2H, 4M, 3L, 2I |
| @nextjs-dashboard | Server/Client boundary, filtros, badges, tipos, UX | 0C, 1H, 3M, 3L, 0I |

**Consolidado Ronda 1: 0 CRITICAL, 4 HIGH, 12 MEDIUM, 13 LOW, 7 INFO**

### 4 HIGH corregidos (commit ab6b1ba)

| # | Hallazgo | Fix | Archivo |
|---|----------|-----|---------|
| H-01 | `classify_profile` de V4 hereda logica de V2 (usa `days_until_predicted` que V4 no tiene) — "En riesgo" nunca se dispara | Override con logica basada en `window_days` (120d = "En riesgo") | `recuperacion.py` |
| H-02 | metadata almacena int pero dedup compara como text — fragil ante cambios | Comentarios de invariante en `build_metadata` de V1 y V4 | `activacion.py`, `recuperacion.py` |
| H-03 | Indice `idx_customers_new` con `WHERE status='new'` — 0 filas, nunca se usa | Migracion 025: reemplaza por `idx_customers_activation` (status='active' + count=1) | `025_fix_idx_customers_new.sql` |
| H-04 | "Contactar Hoy" sin filtro de fecha — muestra predicciones viejas acumuladas | `.gte("prediction_date", threeDaysAgo)` con ventana de 3 dias | `contactar/page.tsx` |

### Ronda 2 — Verificacion post-fixes

| Agente | Resultado |
|---|---|
| @security-guardian | 4/4 fixes verificados, 0 regresiones, 0 nuevos hallazgos |
| @db-architect | 4/4 fixes verificados, indice matchea query, rollback correcto |
| @python-engine | 4/4 fixes verificados, firma correcta, manejo NULL OK |
| @nextjs-dashboard | H-04 verificado, DST aceptable, M-FE-03 reclasificado como falso positivo |

**Consolidado Ronda 2: 0C, 0H, 0 regresiones. APROBADO.**

---

## MEDIUMs diferidos (no bloquean produccion)

| # | Origen | Hallazgo | Cuando resolver |
|---|--------|----------|-----------------|
| M-Sec-01 | R17 | `str(exc)` en base.py sin `sanitize_text()` | Pre multi-usuario |
| M-Sec-02 | R17 | metadata completa enviada al browser (solo se usan 2 campos) | Pre multi-usuario (PostgREST VIEW) |
| M-FE-01 | R17 | Normalizacion customer duplicada en server y client | Cleanup posterior |
| M-FE-02 | R17 | cross_sell ausente en vertical-filter.tsx | Cuando se active V3 |
| M-Py-01 | R17 | Falta type hint `psycopg.Connection` en `conn` | Cleanup posterior |
| M-Py-02 | R17 | `candidate.get('x', 0)` no protege contra NULL (deberia ser `or 0`) | Cleanup posterior |
| M-Py-03 | R17 | `first_purchase_date` podria llegar como string en tests | Cuando haya tests |
| M-Py-04 | R17 | Factores de confianza se calculan dos veces por candidato | Optimizacion |
| M-DB-01 | R17 | 3 queries con pattern repetido en CASE/BETWEEN | Refactor posterior |

---

## Estado completo de fases

| Fase | Estado | Auditoria |
|---|---|---|
| Fase 0 | COMPLETADA | N/A (fundacion) |
| Fase 1 | COMPLETADA | AUDITADA 0C/0H |
| Fase 2 (Motor) | COMPLETADA | AUDITADA 0C/0H |
| Fase 3 (Dashboard) | COMPLETADA | AUDITADA 0C/0H |
| Smart File Upload | COMPLETADO | Cubierto en audit Ingesta |
| Ingesta Fase 2 | COMPLETADA | AUDITADA 0C/0H |
| Fase 4 (Automatizacion) | COMPLETADA | AUDITADA 0C/0H |
| **Fase 5 (V1+V4)** | **COMPLETADA** | **AUDITADA 0C/0H** |

**26 migraciones ejecutadas** (001-025 + rollbacks)

---

## Archivos modificados en auditoria

| Archivo | Cambio |
|---------|--------|
| `backend/engine/verticales/recuperacion.py` | +28 lineas: override classify_profile |
| `backend/engine/verticales/activacion.py` | +3 lineas: comentario invariante |
| `database/migrations/025_fix_idx_customers_new.sql` | Nuevo: DROP idx_customers_new + CREATE idx_customers_activation |
| `database/migrations/025_rollback.sql` | Nuevo: rollback del indice |
| `frontend/src/app/(dashboard)/contactar/page.tsx` | +6 lineas: filtro prediction_date 3 dias |

---

## Pendientes no-bloqueantes

- **Duplicados de ingesta:** Si se sube otro Excel/Smart File Upload se recrean duplicados (external_id distinto por canal). Fix en capa de ingesta (matching por nombre).
- **Error pre-existente en atribucion:** `IndeterminateDatatype` en `update_prediction_attribution()` — NO introducido por Fase 5.
- **V1 sin candidatos hoy:** Los clientes mas cercanos entran en ventana en 2 dias (FundaMaster, dia 25).

---

## Proxima fase: Fase 6 — Canal WhatsApp (Kommo)

Segun `docs/ROADMAP.md` (Semanas 13-15):

1. **Integracion Kommo CRM** — conexion API, sync contactos
2. **Envio WhatsApp** — templates aprobados por Meta
3. **Tracking de envios** — status de mensajes (sent/delivered/read)
4. **Atribucion mejorada** — link entre mensaje enviado y compra

---

## Prompt para iniciar sesion nueva

```
Lee el handoff en docs/handoffs/2026-02-26_fase5_audit_session.md.

Fase 5 COMPLETADA + AUDITADA (0C/0H). 4 HIGH corregidos en 2 rondas.
3 verticales operativas: V2 Reposicion + V1 Activacion + V4 Recuperacion.
Dashboard con filtro por vertical, badges con contexto, ventana 3 dias.
26 migraciones ejecutadas (001-025).

Proxima tarea: Fase 6 — Canal WhatsApp via Kommo.
Ver docs/ROADMAP.md seccion Fase 6.
```
