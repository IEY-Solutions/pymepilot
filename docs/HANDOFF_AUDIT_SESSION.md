# Traspaso: Sesion de Auditoria con Agentes Internos

**Fecha:** 2026-02-20
**Ultimo commit:** pendiente (cambios sin commitear)
**Sesion anterior:** Auditoria automatizada con 4 agentes internos

---

## Estado actual

El plan de Fase 1 paso:
- 13 iteraciones de auditoria manual por Pato
- 1 ronda de auditoria automatizada con 4 agentes internos
- 2 migraciones ejecutadas (011 + 012)
- 6 fixes aplicados al plan
- 20/20 tests de regresion pasaron

## Que se hizo en esta sesion

### Auditoria con 4 agentes (en paralelo)

| Agente | Criticos | Importantes | Sugerencias | Veredicto |
|--------|----------|-------------|-------------|-----------|
| @security-guardian | 0 | 2 | 4 | Aprobar con condiciones |
| @db-architect | 1 | 4 | 3 | Aprobar con condiciones |
| @python-engine | 1 | 5 | 7 | Aprobar con condiciones |
| @api-integrations | 1 | 4 | 5 | Aprobar con condiciones |

### Hallazgo CRITICO (unanime, ya resuelto)

sync_log CHECK constraint no admitia 'requires_review'. Resuelto con migracion 011.

### 3 acciones ejecutadas

**ACCION 1 — Migracion 011 (ejecutada en DB):**
- sync_log.status: +requires_review
- sync_log.sync_type: +limited
- erp_config comment actualizado

**ACCION 2 — Migracion 012 (ejecutada en DB):**
- Usuario `pymepilot_app` creado (nosuperuser, nocreatedb, nocreaterole)
  - PASSWORD: placeholder 'CHANGE_ME_IMMEDIATELY' — Pato debe cambiar antes de usar
  - .env aun usa DATABASE_USER=postgres — cambiar cuando se implemente Fase 1
- FORCE ROW LEVEL SECURITY en 7 tablas (customers, products, orders, order_items, predictions, sync_log, user_profiles)
- tenants correctamente SIN FORCE RLS
- UNIQUE constraint en sku de products eliminado (mantiene solo external_id)

**ACCION 3 — 6 fixes aplicados al plan:**
- I-4: validate_fernet_key → paso 2 con Fernet(key.encode())
- I-5: TenantCredentials.__exit__ → getattr defensivo
- I-6: SanitizingFormatter → sanitizar record.exc_text en paso 4b
- I-7: Entry points → os.umask(0o077)
- I-8: rotate_encryption_key → try/finally por iteracion
- I-9: _get_paginated() → safeguard max_pages=100 + re-auth transparente

### Verificacion: 20/20 tests de regresion pasaron

Script: `backend/scripts/test_regression_012.py`

Tests: pool, tenant_id_by_slug, conexion con/sin context, constraints nuevos,
constraints viejos, sku duplicado permitido, external_id unico, pymepilot_app
existe, FORCE RLS en tablas correctas, comment actualizado.

## Hallazgos IMPORTANTES de agentes (no resueltos aun — para segunda ronda)

Estos hallazgos fueron documentados pero NO bloquearon la auditoria.
La sesion nueva deberia decidir cuales incorporar al plan antes de implementar:

### De @api-integrations (4):
- I-10: Token expirado a mitad de paginacion — documentar que re-auth ocurre en _get()
- I-11: Respuestas HTTP no-JSON (mantenimiento, WAF) — capturar JSONDecodeError en _get()
- I-12: Redirects HTTP — documentar decision consciente (defaults de requests)
- order_items: documentar estrategia DELETE+INSERT (no tiene ON CONFLICT)

### De @python-engine (sugerencias relevantes):
- encrypt_secret: aceptar bytes|bytearray|str (evitar conversion en rotate)
- decrypt_secret: documentar limitacion de bytes inmutable intermedio
- Campos derivados: especificar UPDATE...FROM con subquery, no loop Python
- load_dotenv(): mover a entry points, quitar de modulos internos

### De @security-guardian (sugerencias):
- set_tenant_context: session-level vs transaction-level (relevante para multi-tenant futuro)
- Test 12 del plan: agregar Parte D con usuario no-superuser

## Archivos modificados (sin commitear)

```
database/migrations/011_update_sync_log_constraints.sql  (NUEVO)
database/migrations/011_rollback.sql                     (NUEVO)
database/migrations/012_app_user_and_rls_force.sql       (NUEVO)
database/migrations/012_rollback.sql                     (NUEVO)
backend/scripts/test_regression_012.py                   (NUEVO)
docs/HANDOFF_AUDIT_SESSION.md                            (MODIFICADO)
~/.claude/plans/gentle-riding-dijkstra.md                (MODIFICADO — 6 edits)
```

## Proximos pasos

1. **Sesion nueva:** Leer este handoff + plan detallado
2. **Decidir** sobre hallazgos importantes pendientes (incorporar o documentar como deuda)
3. **Segunda ronda de auditoria** (opcional, si Pato quiere)
4. **Commitear** migraciones 011+012 + test de regresion
5. **Aprobar plan** (ExitPlanMode)
6. **Abrir sesion de IMPLEMENTACION** (separada de auditoria)
7. **Implementar** pasos 1-12 del plan
8. **Pato ejecuta** pasos 13-17 manualmente (credenciales, sync)

## Decisiones ya tomadas (NO renegociar)

Todo lo de la sesion anterior +
- pymepilot_app como usuario de DB (no postgres)
- FORCE ROW LEVEL SECURITY en todas las tablas con tenant_id
- Sin UNIQUE en sku de products (solo external_id)
- validate_fernet_key con construccion real de Fernet
- __exit__ defensivo con getattr
- SanitizingFormatter cubre record.exc_text
- os.umask(0o077) en entry points
- try/finally por iteracion en rotate_encryption_key
- max_pages=100 como safeguard en paginacion
