# Handoff — Fase 8: Multi-Tenant Productivo (Implementacion)

**Fecha:** 2026-03-03
**Commit:** `3f11d79` (feat: fase 8 — multi-tenant productivo)
**Estado:** Implementado, listo para auditoria
**Design doc:** `docs/plans/2026-03-02-fase8-multi-tenant-productivo-design.md`

---

## Que se hizo

### Sesion 1 — Fix MEDIUMs (3 items)

| ID | Archivo | Cambio | Estado |
|----|---------|--------|--------|
| M-01 | `base.py:44,203` | `sanitize_text(str(exc))` en error handler | Implementado |
| M-02 | Sin cambio | Cerrado como falso positivo — VIEW `client_rankings_secure` solo expone 8 columnas seguras (customer_id, name, revenue, ranking, etc.) sin metadata | Cerrado |
| M-03 | `sync.py:314-391,619-653` | `normalize_customer_name()` + dedup en `_upsert_customers()` — solo Smart Upload (`su_` prefix), match exacto | Implementado |

### Sesion 2 — Script de Onboarding

| Archivo | Descripcion |
|---------|-------------|
| `backend/scripts/create_tenant.py` | Script interactivo de 5 pasos |

**5 pasos del script:**
1. Datos del tenant (nombre, slug, erp_type, verticales) — validacion contra CHECK constraints
2. Crear tenant en DB — INSERT, idempotente (detecta slug existente)
3. Crear usuario GoTrue — POST `/auth/v1/admin/users` con `app_metadata: {tenant_id}` + INSERT `user_profiles`
4. Credenciales ERP — getpass + Fernet via `save_tenant_credentials()` (skip si excel)
5. Verificacion — 3 checks (RLS isolation, profile exists, tenant record)

**Dependencias reutilizadas:** `connection.py`, `crypto.py`, `settings.py` (SUPABASE_URL, SERVICE_ROLE_KEY)
**Patron:** Mismo entry point que `sync_erp.py` (sys.path.insert → load_dotenv → umask → imports)

### Sesion 3 — Testing + Dashboard + Docs

| Archivo | Resultado |
|---------|-----------|
| `database/tests/tenant_isolation_test.sql` | 7/7 PASS, 0 FAIL |
| `frontend/src/components/datos/erp-status-card.tsx` | 5 estados con colores |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Query tenant + ErpStatusCard |
| `docs/ONBOARDING.md` | Guia completa |

**Detalle de los 7 tests de aislamiento:**

| Test | Verifica | Role | Resultado |
|------|----------|------|-----------|
| T1 | IEY no ve customers del test | pymepilot_app | PASS: 0 clientes visibles |
| T2 | Test ve solo sus 5 customers | pymepilot_app | PASS: exactamente 5 |
| T3 | Sin contexto = 0 filas | pymepilot_app | PASS: fail-closed |
| T4 | INSERT cross-tenant bloqueado | pymepilot_app | PASS: RLS violation |
| T5 | Predictions aisladas | pymepilot_app | PASS: 0 cross-tenant |
| T6 | client_rankings_secure filtra | authenticated | PASS: test=0, iey=165 |
| T7 | RPCs respetan contexto | pymepilot_app | PASS: revenues distintos |

**Nota T6:** La VIEW solo tiene GRANT SELECT para `authenticated`, no `pymepilot_app`. El test cambia de role temporalmente.

---

## Archivos modificados/creados

| Archivo | Accion | Lineas |
|---------|--------|--------|
| `backend/engine/verticales/base.py` | Modificado | +2 (import + sanitize) |
| `backend/engine/connectors/sync.py` | Modificado | +80 (dedup + normalize) |
| `backend/scripts/create_tenant.py` | **Nuevo** | ~340 lineas |
| `database/tests/tenant_isolation_test.sql` | **Nuevo** | ~300 lineas |
| `frontend/src/components/datos/erp-status-card.tsx` | **Nuevo** | ~170 lineas |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Modificado | +30 lineas |
| `docs/ONBOARDING.md` | **Nuevo** | ~150 lineas |

**Total:** 7 archivos, +1282 lineas

---

## Verificaciones realizadas

- [x] Import `base.py` OK
- [x] Import `sync.py` + `normalize_customer_name` OK
- [x] Normalizacion: "GARCIA  SRL" == "garcia srl" (match exacto)
- [x] Test aislamiento SQL: 7/7 PASS, 0 FAIL
- [x] Frontend build: 0 errores TypeScript (21.3s)
- [x] MEMORY.md actualizado

---

## Para la sesion de auditoria

### Archivos a auditar (7)

```
backend/engine/verticales/base.py          (2 lineas cambiadas)
backend/engine/connectors/sync.py          (80 lineas cambiadas)
backend/scripts/create_tenant.py           (archivo nuevo, 340 lineas)
database/tests/tenant_isolation_test.sql   (archivo nuevo, 300 lineas)
frontend/src/components/datos/erp-status-card.tsx  (archivo nuevo, 170 lineas)
frontend/src/app/(dashboard)/datos/page.tsx  (30 lineas cambiadas)
docs/ONBOARDING.md                         (archivo nuevo, 150 lineas)
```

### Puntos de atencion para la auditoria

1. **create_tenant.py** — Es el archivo mas critico. Toca GoTrue API, DB, y credenciales. Verificar:
   - Que `app_metadata` (no `user_metadata`) es lo que se setea
   - Que SERVICE_ROLE_KEY no se loguea en ningun path
   - Que el error handling no expone info sensible
   - Que getpass se usa correctamente

2. **sync.py dedup** — Verificar:
   - Que solo aplica a `su_` prefix (no a IDs del ERP)
   - Que `normalize_customer_name` es consistente con `_content_hash` de smart.py
   - Que no hay race conditions en el mapa `existing_by_name`

3. **erp-status-card.tsx + page.tsx** — Verificar:
   - Que `erp_config` (contiene `client_secret_encrypted`) no se expone al browser
   - Que el query solo lee `erp_type` y `erp_config` (para boolean check de `client_id`)

4. **tenant_isolation_test.sql** — Verificar:
   - Que el CLEANUP realmente borra todo (CASCADE)
   - Que el UUID fijo no colisiona con datos reales

### MEDIUMs diferidos que siguen pendientes

- CORS abierto en Kong (requiere root)
- EXCEPTION WHEN OTHERS en refresh_materialized_views
- Cast inseguro metadata->>'attribution_amount' en get_monthly_value
- Parametros int sin limite superior en RPCs
- UNION ALL en cross_sell_candidates puede dar avg impreciso
- `any` en 4 CustomTooltip de charts
- formatCurrency duplicado en 7 archivos frontend

---

## Proximo paso

Abrir sesion nueva → invocar auditoria con agentes internos (`@security-guardian`, `@db-architect`, `@python-engine`) sobre los 7 archivos del commit `3f11d79`.
