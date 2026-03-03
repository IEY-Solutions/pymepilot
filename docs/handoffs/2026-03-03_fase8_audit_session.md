# Handoff — Fase 8: Multi-Tenant Productivo (Auditoria)

**Fecha:** 2026-03-03
**Commits:** `3f11d79` (impl) → `c69bd29` (audit fixes)
**Estado:** COMPLETADA + AUDITADA (2 rondas, 0C/0H)
**Design doc:** `docs/plans/2026-03-02-fase8-multi-tenant-productivo-design.md`

---

## Auditoria Ronda 1

**Agentes:** @security-guardian + @db-architect + @python-engine (3 en paralelo)
**Archivos auditados:** 7 del commit `3f11d79`
**Resultado:** 1C, 3H, 7M, 9L, 6I

### Hallazgos bloqueantes

| ID | Sev | Hallazgo | Causa raiz |
|----|-----|----------|------------|
| C-01 | CRITICAL | `erp_config` (con `client_secret_encrypted`) expuesto a todos los usuarios `authenticated` via PostgREST | Cadena acumulada: migration 012 (tenants sin RLS), migration 017 (GRANT SELECT a authenticated), Fase 8 (erp_config empezo a guardar secrets). `page.tsx` hacia `from("tenants").select("erp_type, erp_config")`. |
| H-01 | HIGH | `create_tenant.py` no puede INSERT en `tenants` | Migration 023 revoco INSERT para pymepilot_app (correcto). El script usa `get_db_connection_no_tenant()` que conecta como pymepilot_app. Nunca se probo end-to-end. |
| H-02 | HIGH | `create_tenant.py` no puede INSERT en `user_profiles` | FORCE RLS en user_profiles bloquea INSERT sin JWT context. El script corre desde CLI, sin JWT. |
| H-03 | HIGH | `print(exc)` sin `sanitize_text()` en create_tenant.py | 4 rutas de error usaban `print(f"...{exc}")` directamente, bypaseando SanitizingFormatter. Excepciones pueden contener fragments de credenciales/URLs internas. |

### Hallazgos no bloqueantes (diferidos)

- **7 MEDIUM:** input() bloquea en step2, GoTrue paginacion 50 users, error_body sin truncar, plus 4 menores
- **9 LOW:** validaciones de input, error messages verbosos, etc.
- **6 INFO:** documentacion, mejoras cosmeticas

---

## Fixes aplicados (commit `c69bd29`)

### Fix C-01: REVOKE + VIEW + SECURITY DEFINER

**Archivo:** `database/migrations/031_secure_tenants_access.sql` (154 lineas)

1. `REVOKE SELECT ON tenants FROM authenticated` — corta acceso directo
2. VIEW `tenant_info_secure`:
   - 7 columnas seguras: `id, name, slug, erp_type, active, active_verticals, has_erp_credentials`
   - `has_erp_credentials` es boolean derivado (no expone valores reales)
   - Filtro: `WHERE id = get_current_tenant_id()` — cada tenant solo ve su fila
   - `GRANT SELECT TO authenticated`
3. `frontend/src/app/(dashboard)/datos/page.tsx`: query cambiado a `tenant_info_secure`

### Fix H-01: admin_create_tenant()

Funcion SECURITY DEFINER que ejecuta como postgres (bypasa restricciones de pymepilot_app):
- `SET search_path = public` (anti search_path hijack)
- `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO pymepilot_app`
- `create_tenant.py` linea 209: `SELECT admin_create_tenant(...)`

### Fix H-02: admin_upsert_user_profile()

Mismo patron SECURITY DEFINER:
- `ON CONFLICT (id) DO NOTHING` (idempotente)
- `create_tenant.py` linea 308: `SELECT admin_upsert_user_profile(...)`

### Fix H-03: sanitize_text en prints

- Linea 103: `sanitize_text(error_body)` + truncar a 500 chars
- Linea 296: `sanitize_text(str(inner_exc))`
- Linea 299: `sanitize_text(str(exc))`
- Linea 473: `sanitize_text(str(exc))`

### Fix adicional: crypto.py

- `save_tenant_credentials()`: UPDATE directo → `SELECT admin_save_erp_config(slug, config::jsonb)`
- `rotate_encryption_key()`: UPDATE directo → `SELECT admin_save_erp_config(slug, config::jsonb)`
- Funcion `admin_save_erp_config()` tambien en migration 031 (SECURITY DEFINER)

### Tests expandidos

`database/tests/tenant_isolation_test.sql` v2: 12 tests (era 7)
- T4b: UPDATE cross-tenant bloqueado
- T4c: DELETE cross-tenant bloqueado
- T8: sync_log aislado
- T9: user_profiles aislado
- T10: tenant_info_secure VIEW filtra correctamente

---

## Auditoria Ronda 2

**Agentes:** @security-guardian + @db-architect + @python-engine (3 en paralelo)
**Archivos auditados:** 6 del commit `c69bd29`

### Resultado: 5/5 fixes verificados, 0 regresiones, 0C/0H

| ID | Sev | Estado |
|----|-----|--------|
| C-01 | CRITICAL | RESUELTO — 3/3 agentes verificaron |
| H-01 | HIGH | RESUELTO — 3/3 agentes verificaron |
| H-02 | HIGH | RESUELTO — 3/3 agentes verificaron |
| H-03 | HIGH | RESUELTO — 3/3 agentes verificaron |
| crypto.py | HIGH | RESUELTO — 3/3 agentes verificaron |

### Nuevos hallazgos (no bloqueantes)

| ID | Sev | Detalle |
|----|-----|---------|
| R2-M01 | MEDIUM | `admin_save_erp_config` no valida relacion caller-tenant (mitigado: solo pymepilot_app puede invocar) |
| R2-M02 | MEDIUM | Sin test unitario especifico para migration 031 (cubierto por T10) |
| R2-L01 | LOW | `admin_create_tenant` no valida inputs (depende de CHECK constraints DB) |
| R2-L02 | LOW | `has_erp_credentials` true si client_id existe sin client_secret_encrypted |
| R2-L03 | LOW | `rotate_encryption_key` depende de SELECT directo (pymepilot_app tiene permiso) |

---

## Archivos modificados/creados en audit fixes

| Archivo | Accion | Cambio |
|---------|--------|--------|
| `database/migrations/031_secure_tenants_access.sql` | **Nuevo** | REVOKE + VIEW + 3 SECURITY DEFINER |
| `database/migrations/031_rollback.sql` | **Nuevo** | Rollback completo |
| `backend/scripts/create_tenant.py` | Modificado | SECURITY DEFINER calls + sanitize_text |
| `backend/engine/connectors/crypto.py` | Modificado | admin_save_erp_config |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Modificado | tenant_info_secure |
| `database/tests/tenant_isolation_test.sql` | Reescrito | 12 tests (era 7) |

---

## MEDIUMs diferidos globales (no bloquean deploy)

- CORS abierto en Kong (requiere root)
- EXCEPTION WHEN OTHERS en refresh_materialized_views
- Cast inseguro metadata->>'attribution_amount' en get_monthly_value
- Parametros int sin limite superior en RPCs
- UNION ALL en cross_sell_candidates puede dar avg impreciso
- `any` en 4 CustomTooltip de charts
- formatCurrency duplicado en 7 archivos frontend
- Normalizacion customer duplicada en contactar (cleanup)

---

## Veredicto

**Fase 8: COMPLETADA + AUDITADA — 2 rondas, 0C/0H.**

Sistema listo para onboarding del segundo tenant.
