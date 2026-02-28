# Handoff Fase 8 — Multi-Tenant Productivo

**Fecha:** 2026-02-28
**Estado:** Listo para planificacion
**Prerequisito:** Fases 0-7 completadas y auditadas (0C/0H)

---

## Contexto

PymePilot funciona en produccion para IEY (unico tenant). El sistema es
multi-tenant por diseno (tenant_id + RLS desde Fase 0), pero nunca se
probo con un segundo tenant real. Fase 8 prepara el sistema para recibir
el segundo distribuidor.

---

## Que existe hoy (multi-tenant readiness)

### Funciona correctamente

| Componente | Estado | Detalle |
|------------|--------|---------|
| RLS (Row Level Security) | OK | 7 tablas con policy `tenant_id = get_current_tenant_id()` |
| FORCE RLS | OK | Bloquea incluso superuser sin tenant context |
| get_current_tenant_id() | OK | Dual-mode: JWT (dashboard) + app.tenant_id (Python) |
| set_tenant_context() | OK | Pool reset fail-closed |
| Orquestador multi-tenant | OK | Itera todos los tenants activos, --tenant-slug para filtrar |
| active_verticals JSONB | OK | Cada tenant elige sus verticales |
| setup_credentials.py | OK | Encripta credenciales por tenant (Fernet) |
| Frontend sin hardcodes | OK | Usa JWT tenant_id, sin referencias a IEY |
| Backend sin hardcodes | OK | Todos los scripts usan --tenant-slug |
| MVs con tenant_id | OK | co_purchases y client_rankings particionan por tenant |
| VIEW client_rankings_secure | OK | Filtra MV por get_current_tenant_id() |
| co_purchases sin GRANT auth | OK | Fix H-01 Fase 7 — solo pymepilot_app |

### NO existe (scope Fase 8)

| Componente | Que falta |
|------------|-----------|
| Script de onboarding | No hay create-tenant.sh ni automatizacion |
| Crear usuario admin | Manual (Supabase Auth + user_profiles INSERT) |
| Pagina config ERP | /datos muestra estado, no permite configurar |
| Test aislamiento | 0 tests. Guias en .claude/commands/ pero sin implementar |
| Documentacion onboarding | No existe |
| MEDIUMs pre multi-usuario | 3 pendientes (sanitize, metadata, dedup) |

---

## MEDIUMs pre multi-usuario (resolver en Fase 8)

| MEDIUM | Ubicacion | Riesgo |
|--------|-----------|--------|
| str(exc) sin sanitize_text() | base.py | Error de tenant A puede exponer datos internos en logs |
| metadata completa al browser | PostgREST VIEW | Counts de predicciones podrian filtrar entre tenants |
| Customer duplicados por canal | contactar/ | external_id distinto por canal crea filas duplicadas |

---

## Tabla tenants (schema actual)

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    erp_type TEXT,  -- 'contabilium','excel','xubio','alegra','colppy','custom'
    erp_config JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    active_verticals JSONB DEFAULT '["reposicion"]',
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

---

## Tareas Fase 8 (del ROADMAP)

1. Script automatizado de onboarding (crear tenant + configurar ERP + usuario admin)
2. Pagina de configuracion de conector ERP en dashboard (admin conecta su propio ERP)
3. Upload de Excel como alternativa para clientes sin ERP (ya existe Smart File Upload)
4. Testing exhaustivo de aislamiento entre tenants
5. Documentacion de proceso de onboarding

---

## Recursos disponibles

- `.claude/skills/database/multi-tenant-rls.md` — RLS patterns
- `.claude/skills/database/tenant-isolation-testing.md` — Test suite guide
- `.claude/skills/database/rls-testing.md` — RLS testing patterns
- `.claude/skills/security/security-audit-checklist.md` — Checklist pre-deploy
- `.claude/skills/integrations/data-transformation.md` — Schema mapping
- `backend/scripts/setup_credentials.py` — Referencia para encriptar creds
- `backend/engine/connectors/` — Conectores existentes (base, contabilium, excel, smart)

---

## Archivos clave para Fase 8

- `backend/engine/db/connection.py` — Pool + tenant context
- `backend/main.py` — Orquestador (ya itera todos los tenants)
- `backend/engine/connectors/base.py` — ERPConnector ABC
- `backend/scripts/setup_credentials.py` — Setup de credenciales
- `database/migrations/002_create_tenants.sql` — Schema tenants
- `database/migrations/017_rls_dual_mode_and_permissions.sql` — RLS dual-mode
- `frontend/src/app/(dashboard)/datos/page.tsx` — Pagina de datos actual

---

## Estado del sistema

- **30 migrations** aplicadas en orion_db (001-030)
- **DB:** orion_db en container orion-menteax_postgres (172.18.0.10:5432)
- **Tenant IEY:** 165 clientes, 2492 productos, 351 ordenes, 4 verticales activas
- **Crontab:** 5 jobs (backup, upload worker, Drive sync, orquestador, freshness)
- **Bug login:** GoTrue rechaza password (pre-existente, no de Fase 7)
- **Frontend:** Docker en app.pymepilot.cloud via Traefik

---

## MEDIUMs diferidos globales (Fase 7 audit)

Ademas de los 3 pre multi-usuario, hay 7 MEDIUMs de la auditoria de Fase 7:
- EXCEPTION WHEN OTHERS en refresh_materialized_views
- Cast inseguro metadata->>'attribution_amount'
- Parametros int sin limite superior en RPCs
- UNION ALL precision en avg_co_purchase_rate
- `any` en 4 CustomTooltip charts
- Sin loading.tsx propio para /metricas
- formatCurrency duplicado en 7 archivos frontend
