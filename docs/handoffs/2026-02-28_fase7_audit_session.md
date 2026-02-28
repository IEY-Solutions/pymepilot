# Handoff Fase 7 — Sesion de Auditoria

**Fecha:** 2026-02-28
**Commit fixes:** `c499620`
**Estado:** AUDITADA — 0C, 0H. Aprobada para produccion.

---

## Resultado de auditoria

### Ronda 1 — 3 agentes en paralelo (31 archivos)

| Area | Agente | Archivos | C | H | M | L | I |
|------|--------|----------|---|---|---|---|---|
| Migrations SQL | db-architect | 6 | 0 | 1 | 3 | 6 | 4 |
| Backend Python | python-engine | 5+2 ctx | 0 | 1 | 5 | 5 | 8 |
| Frontend TS | nextjs-dashboard | 13 | 0 | 0 | 5 | 6 | 9 |
| **Total** | | **31** | **0** | **2** | **11** | **17** | **21** |

*(M-01 SQL = M-03 Backend, deduplicado: 11 unicos)*

### 5 fixes aplicados (commit `c499620`)

| ID | Fix | Archivo |
|----|-----|---------|
| H-01 | REVOKE SELECT co_purchases FROM authenticated | `029_revoke_co_purchases_authenticated.sql` |
| H-02 | LIMIT 5 en get_cross_sell_candidates | `backend/engine/db/queries.py` |
| M-04 | status='completed' en MV co_purchases | `030_fix_co_purchases_status_filter.sql` |
| M-05 | Perfil "En riesgo" eliminado del prompt | `backend/config/prompts/cross_sell.txt` |
| M-10 | Error handling + retry en client-detail | `frontend/.../client-detail.tsx` |

### Ronda 2 — Re-auditoria post-fix

3 agentes verificaron los 5 fixes:
- **5/5 fixes correctos**
- **0 regresiones**
- **0 nuevos HIGH/MEDIUM**
- 1 LOW nuevo (comentario engañoso en 030_rollback)
- 2 INFO nuevos (029 redundante si 030 aplica, COMMENT perdido)

---

## Hallazgo operativo descubierto durante auditoria

Las migrations se estaban aplicando contra `postgres` (DB por defecto) en vez de `orion_db` (DB correcta con datos reales). Las migrations 026-028 ya estaban en orion_db desde la implementacion. Lo aplicado accidentalmente en postgres fue limpiado.

**Recordatorio critico:** SIEMPRE usar `-d orion_db` al ejecutar psql.

---

## MEDIUMs restantes (8, no bloquean)

| ID | Area | Hallazgo |
|----|------|----------|
| M-01 | SQL | EXCEPTION WHEN OTHERS en refresh_materialized_views |
| M-02 | SQL | Cast inseguro metadata->>'attribution_amount' |
| M-03 | SQL | Parametros int sin limite superior en RPCs |
| M-06 | Python | _calculate_factors doble calculo por candidato |
| M-07 | Python | UNION ALL puede dar avg_co_purchase_rate impreciso |
| M-08 | TS | 8x `any` en CustomTooltip (con eslint-disable) |
| M-09 | TS | Sin loading.tsx propio para /metricas |
| M-11 | TS | formatCurrency duplicado en 7 archivos |

---

## Verificaciones positivas de seguridad

- Aislamiento tenant: triple filtro tenant_id en queries Python, RLS en RPCs
- SQL injection: 0 — prepared statements en todas las queries
- XSS: 0 — sin dangerouslySetInnerHTML
- Secrets: 0 en los 31 archivos
- Server/Client boundary: correcto
- Exports: datos pre-filtrados por RLS, sin queries adicionales
- Template Method: VerticalCrossSell implementa correctamente VerticalBase
- Logica semanal: weekday()==0 (lunes) correcto
- Refresh MVs: una vez, antes del loop de tenants
