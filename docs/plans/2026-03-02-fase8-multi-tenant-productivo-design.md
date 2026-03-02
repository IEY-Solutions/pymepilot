# Fase 8 — Multi-Tenant Productivo (Design Doc)

**Fecha:** 2026-03-02
**Estado:** Aprobado
**Prerequisito:** Fases 0-7 completadas y auditadas (0C/0H)
**Enfoque:** Script-first, dashboard-lite

---

## Objetivo

Preparar PymePilot para recibir el segundo distribuidor. El sistema ya es
multi-tenant por diseno (RLS, tenant_id, orquestador), pero nunca se probo
con un segundo tenant real. Esta fase cierra las brechas operativas.

---

## Decisiones de diseno

| Decision | Elegido | Descartado | Razon |
|----------|---------|------------|-------|
| Operador de onboarding | Pato via CLI | Dashboard admin / Self-service | Volumen bajo (1 tenant cada semanas/meses). CLI es mas seguro y menos codigo. |
| Config ERP en dashboard | Solo ver estado | Config completa desde browser | Menos superficie de ataque. Credenciales no viajan por HTTP. |
| Testing de aislamiento | Script SQL manual | Suite pytest automatizada | Suficiente para validar ahora. Pytest se agrega si escala a 10+ tenants. |
| Enfoque general | Script-first | Dashboard admin completo / Testing-first | Pragmatico: menos codigo, entregable rapido, cubre lo critico. |

---

## Entregable 1: Script de Onboarding (`create_tenant.py`)

### Flujo

```
python backend/scripts/create_tenant.py

Paso 1: Datos del tenant (input interactivo)
  → Nombre, slug, erp_type, verticales activas

Paso 2: Crear tenant en DB
  → INSERT en tenants (con validacion de slug unico)
  → Idempotente: si el slug ya existe, ofrece continuar desde donde quedo

Paso 3: Crear usuario admin en GoTrue
  → Email + password (getpass)
  → POST a GoTrue API para crear auth.users
  → INSERT user_profile (rol=admin, tenant_id)
  → PATCH app_metadata con tenant_id (para JWT/RLS)

Paso 4: Configurar credenciales ERP (si erp_type tiene API)
  → Reutiliza logica de setup_credentials.py
  → getpass para client_id + client_secret
  → Encripta con Fernet y guarda en tenants.erp_config

Paso 5: Verificacion automatica
  → RLS check: con contexto del nuevo tenant, no ve datos de IEY
  → Login check: autenticacion contra GoTrue funciona
  → ERP check: test_connection() si tiene API (skip si es excel)
```

### Archivo nuevo

`backend/scripts/create_tenant.py`

### Dependencias

- GoTrue API (Supabase Auth): para crear usuarios
- `crypto.py`: para encriptar credenciales
- `connection.py`: para acceso a DB

### Seguridad

- Todo corre local en el VPS (no expuesto a internet)
- Credenciales por getpass (no quedan en bash history)
- Transaccion atomica: si falla un paso, rollback de lo anterior
- Idempotente: re-ejecutar no crea duplicados

---

## Entregable 2: Dashboard — Card de Estado ERP

### Que se agrega a `/datos`

Una card nueva al inicio de la pagina que muestra:

```
+----------------------------------------------+
|  Conexion ERP                                 |
|                                               |
|  Tipo: Contabilium                            |
|  Estado: [verde] Conectado                    |
|  Ultimo sync exitoso: hoy 5:00 AM            |
|  Registros: 138 clientes | 279 pedidos        |
|                                               |
|  [Probar conexion]                            |
+----------------------------------------------+
```

### Logica de estado

| Condicion | Estado | Color |
|-----------|--------|-------|
| erp_config tiene credenciales + ultimo sync < 48h | Conectado | Verde |
| erp_config tiene credenciales + ultimo sync > 48h | Desactualizado | Amarillo |
| erp_config vacio o sin credenciales | No configurado | Gris |
| erp_type = 'excel' (sin API) | Canal: Subida de archivos | Azul |
| Ultimo sync fallo | Error de conexion | Rojo |

### Boton "Probar conexion"

- Server Action que instancia el conector del tenant y llama `test_connection()`
- Muestra resultado inline (exito/error) sin navegar
- Solo visible si erp_type tiene API (no para excel)

### Archivos modificados

- `frontend/src/app/(dashboard)/datos/page.tsx` — agregar card
- `frontend/src/components/datos/erp-status-card.tsx` — componente nuevo
- `frontend/src/app/(dashboard)/datos/actions.ts` — Server Action para test_connection

### Nota sobre test_connection desde frontend

El Server Action necesita ejecutar codigo Python (el conector ERP). Dos opciones:
1. **API interna:** Crear endpoint Python (Flask/FastAPI) que el Server Action llame
2. **RPC en DB:** Llamar una funcion PostgreSQL que registre el pedido, y un worker lo procese

Para esta fase, opcion simple: el boton "Probar conexion" lee el ultimo sync_log
y muestra su estado. No ejecuta test_connection() en vivo (eso requiere
infraestructura adicional). Si el admin quiere forzar un test, contacta a Pato.

---

## Entregable 3: Testing de Aislamiento

### Script SQL

`database/tests/tenant_isolation_test.sql`

### Tests

| ID | Test | Que hace | Esperado |
|----|------|----------|----------|
| T1 | SELECT con contexto IEY | `set_tenant_context(iey_id)` + SELECT customers | Solo clientes IEY |
| T2 | SELECT con contexto test | `set_tenant_context(test_id)` + SELECT customers | Solo clientes test |
| T3 | SELECT sin contexto | RESET app.tenant_id + SELECT customers | 0 filas |
| T4 | INSERT cross-tenant | Con contexto IEY, INSERT con tenant_id de test | Falla (RLS) |
| T5 | Predictions aisladas | Con contexto test, SELECT predictions | Solo predicciones test |
| T6 | MVs seguras | Con contexto test, SELECT client_rankings_secure | Solo rankings test |
| T7 | RPCs de KPIs | Con contexto test, llamar RPCs | Solo datos test |

### Flujo del script

1. CREATE tenant de prueba con datos ficticios (5 clientes, 10 ordenes)
2. Ejecutar los 7 tests, reportar PASS/FAIL por cada uno
3. CLEANUP: DELETE tenant de prueba y todos sus datos (CASCADE)

### Ejecucion

```bash
docker cp database/tests/tenant_isolation_test.sql orion-menteax_postgres:/tmp/
docker exec orion-menteax_postgres psql -U postgres -d orion_db \
  -f /tmp/tenant_isolation_test.sql
```

---

## Entregable 4: Resolver 3 MEDIUMs pre Multi-Usuario

### M-01: str(exc) sin sanitize_text() en base.py

**Ubicacion:** `backend/engine/verticales/base.py:203`
**Riesgo:** Excepciones pueden contener datos internos que quedan en logs.
**Fix:** Reemplazar `{exc}` por `{sanitize_text(str(exc))}`.
**Archivos:** `base.py` (1 linea, agregar import de sanitize_text si no existe)

### M-02: metadata completa al browser via PostgREST VIEW

**Ubicacion:** VIEW `client_rankings_secure` (migration 027)
**Riesgo:** Metadata interna expuesta al frontend.
**Fix:** Migration 031 que altera la VIEW para excluir `metadata` o solo exponer
campos seguros especificos (nombre, revenue, ranking position).
**Archivos:** `database/migrations/031_secure_rankings_view.sql` + rollback

### M-03: Customer duplicados por canal de ingesta

**Ubicacion:** `backend/engine/connectors/smart.py` + `sync.py`
**Riesgo:** Mismo cliente aparece 2 veces si se carga por API y por Excel.
**Fix:** Deduplicacion por nombre normalizado en Smart Upload:
1. Antes de insertar, normalizar nombre (lowercase, sin acentos, trim)
2. Buscar cliente existente con nombre normalizado igual y mismo tenant_id
3. Si existe → UPDATE (merge datos, preservar external_id del mas antiguo)
4. Si no existe → INSERT normal

**Estrategia conservadora:** Solo dedup automatico si match es exacto (nombre
normalizado identico). Para matches parciales (fuzzy), crear log de "posibles
duplicados" para revision manual. Prioridad: no perder datos.

**Archivos:** `smart.py` (logica de dedup), `sync.py` (funcion de normalizacion)

---

## Entregable 5: Documentacion de Onboarding

### Archivo nuevo

`docs/ONBOARDING.md`

### Contenido

1. **Pre-requisitos** — Datos necesarios del distribuidor
2. **Ejecutar el script** — Comando exacto, que esperar en cada paso
3. **Verificacion post-onboarding** — Login, primer sync, verificar datos
4. **Configuracion de verticales** — Como activar/desactivar
5. **Troubleshooting** — Errores comunes y soluciones

---

## Orden de implementacion

| Sesion | Entregable | Razon del orden |
|--------|-----------|-----------------|
| 1 | MEDIUMs (M-01, M-02, M-03) | Limpiar deuda tecnica antes de agregar codigo |
| 2 | Script de onboarding | Pieza central de la fase |
| 3 | Testing de aislamiento | Valida que RLS funciona con 2 tenants |
| 3 | Dashboard (card ERP) | Mejora visual, baja prioridad |
| 3 | Documentacion | Cierra la fase |

---

## Archivos nuevos

| Archivo | Tipo |
|---------|------|
| `backend/scripts/create_tenant.py` | Script Python |
| `frontend/src/components/datos/erp-status-card.tsx` | Componente React |
| `frontend/src/app/(dashboard)/datos/actions.ts` | Server Action |
| `database/tests/tenant_isolation_test.sql` | Script SQL |
| `database/migrations/031_secure_rankings_view.sql` | Migration |
| `database/migrations/031_rollback.sql` | Rollback |
| `docs/ONBOARDING.md` | Documentacion |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/engine/verticales/base.py` | sanitize_text en error handler |
| `backend/engine/connectors/smart.py` | Logica de dedup por nombre |
| `backend/engine/connectors/sync.py` | Funcion de normalizacion |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Agregar card ERP status |

---

## Fuera de scope (Fase 9+)

- Dashboard admin para gestionar tenants desde el browser
- Self-service de onboarding
- Suite pytest automatizada de aislamiento
- Panel de monitoring multi-tenant (Grafana)
- Facturacion/billing por tenant
