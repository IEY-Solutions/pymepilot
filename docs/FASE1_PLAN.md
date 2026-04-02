# Fase 1: Conectores ERP + Carga de Datos IEY

**Estado:** Plan APROBADO, pendiente de implementacion
**Fecha:** 2026-02-20
**Prerequisito:** Fase 0 completada (commit `ad9469a`)
**Iteraciones de revision de seguridad:** 13

---

## Resumen ejecutivo

PymePilot necesita conectarse al ERP de IEY (Contabilium) para leer datos de clientes, productos y ventas. La Fase 0 dejo la base de datos lista con todas las tablas; esta fase las llena con datos reales.

**Principio fundamental:** SOLO LECTURA. Nunca escribir/modificar/eliminar en el ERP del cliente.

---

## Investigacion de la API

La documentacion oficial de Contabilium (ayuda.contabilium.com) da error 403. Los endpoints se descubrieron leyendo un wrapper Laravel publico en GitHub como referencia. Solo se extrajo informacion publica: URLs, parametros, y flujo OAuth2.

**Cero codigo copiado.** Todo se escribe desde cero en Python. Los endpoints se confirmaran empiricamente con el primer request real.

---

## Decisiones de seguridad

### 1. Credenciales encriptadas en DB

- Fernet (AES-128-CBC + HMAC) para `client_secret` en `tenants.erp_config`
- Clave maestra (`ERP_ENCRYPTION_KEY`) solo en `.env`
- Validacion de formato Fernet al arrancar
- Rotacion atomica con `rotate_encryption_key(old_key, new_key)`

### 2. Logger sanitizado (capa arquitectonica)

`SanitizingFormatter` extiende `logging.Formatter`. Es el UNICO formatter de todos los handlers.

- Sobreescribe `format()`, `formatException()`, y `formatStack()`
- Patrones: palabras clave (token, secret, password, etc.) + regex (Bearer, Fernet, query params)
- Nombres exactos: ERP_ENCRYPTION_KEY, DATABASE_PASSWORD, ANTHROPIC_API_KEY
- `audit_logs_for_secrets()` como segunda linea de defensa post-sync
- Rotacion diaria, retencion 7 dias, permisos 0o600

### 3. Reintentos limitados

| Situacion | Comportamiento |
|-----------|---------------|
| 401 (token expirado) | Re-auth 1 vez. Si segundo 401 -> PARAR |
| 500/502/503 | Max 3 reintentos, backoff exponencial |
| 429 (rate limit) | Respetar Retry-After, max 60s, max 3 reintentos |
| Error de red | Max 3 reintentos, timeout 30s |
| 401 (primer intento) | PARAR inmediatamente |

### 4. Setup seguro de clave Fernet

`setup_credentials.py --init`:
- Paso 0: Verifica `.env` en `.gitignore` (GUARD). Dos modos de fallo:
  - Caso A: `.gitignore` no existe → ABORTA exit 1, "PELIGRO: .gitignore no existe"
  - Caso B: `.gitignore` existe sin `.env` → ABORTA exit 1, "PELIGRO: .env no esta en .gitignore"
- Paso 1-2: Genera Fernet key en memoria, escribe en `.env`
- Paso 3-4: `chmod 600`, verifica con `os.stat()`
- La clave nunca pasa por stdout

### 5. Seed SQL con doble guard

- Guard 1: `app.environment = 'development'`
- Guard 2: tablas customers/orders VACIAS (independiente de config)
- Ambos deben pasar. Si cualquiera falla, aborta.

### 6. Permisos de logs

- Directorio: `0o700`
- Archivos: `0o600`
- Rotacion diaria, retencion 7 dias

---

## API de Contabilium

### Autenticacion
- `POST https://rest.contabilium.com/token`
- `Content-Type: application/x-www-form-urlencoded`
- `grant_type=client_credentials&client_id={email}&client_secret={token_api}`
- Respuesta: `access_token` + `expires_in`

### Endpoints (SOLO GET)

| Recurso | Endpoint | Parametros |
|---------|----------|------------|
| Clientes | `GET api/clientes/search` | filtro, page, pageSize |
| Productos | `GET api/conceptos/search` | filtro, page, pageSize |
| Comprobantes | `GET api/comprobantes/search` | filtro, fechaDesde, fechaHasta, page |

Paginacion: page desde 1, pageSize 50.

---

## Mapeo de campos Contabilium -> PymePilot

> [INFERIDO] = basado en wrapper Laravel. [CONFIRMADO] = verificado con request real.
> Todos arrancan [INFERIDO]. Actualizar a [CONFIRMADO] despues del Test 5 (--limit 5).

### Clientes

| Contabilium | PymePilot (customers) | Estado |
|-------------|----------------------|--------|
| Id | external_id | [INFERIDO] |
| RazonSocial / Nombre | name | [INFERIDO] |
| Email | email | [INFERIDO] |
| Telefono | phone | [INFERIDO] |
| Domicilio | address | [INFERIDO] |
| Localidad | city | [INFERIDO] |
| Observaciones | notes | [INFERIDO] |

### Productos

| Contabilium | PymePilot (products) | Estado |
|-------------|---------------------|--------|
| Id | external_id | [INFERIDO] |
| Codigo | sku | [INFERIDO] |
| Nombre | name | [INFERIDO] |
| Rubro | category | [INFERIDO] |
| SubRubro | subcategory | [INFERIDO] |
| PrecioVenta | price | [INFERIDO] |

### Ordenes

| Contabilium | PymePilot (orders) | Estado |
|-------------|-------------------|--------|
| Id | external_id | [INFERIDO] |
| Fecha | order_date | [INFERIDO] |
| Total | total_amount | [INFERIDO] |
| Cliente.Id | customer_id (via external_id lookup) | [INFERIDO] |
| Items[] | -> order_items | [INFERIDO] |

### Items

| Contabilium (item) | PymePilot (order_items) | Estado |
|--------------------|----------------------|--------|
| Concepto.Id | product_id (via external_id lookup) | [INFERIDO] |
| Concepto.Nombre | product_name | [INFERIDO] |
| Cantidad | quantity | [INFERIDO] |
| PrecioUnitario | unit_price | [INFERIDO] |
| Total | total_price | [INFERIDO] |

---

## Archivos a crear (10)

| # | Archivo | Descripcion |
|---|---------|-------------|
| 1 | `docs/CONTABILIUM_API.md` | Documentacion de referencia de la API |
| 2 | `backend/engine/core/logger.py` | SanitizingFormatter + rotacion + audit |
| 3 | `backend/engine/connectors/base.py` | ERPConnector ABC (solo lectura) |
| 4 | `backend/engine/connectors/contabilium.py` | ContabiliumConnector |
| 5 | `backend/engine/connectors/excel.py` | ExcelConnector (fallback) |
| 6 | `backend/engine/connectors/sync.py` | SyncEngine |
| 7 | `backend/engine/connectors/crypto.py` | Fernet encrypt/decrypt + TenantCredentials |
| 8 | `backend/scripts/sync_erp.py` | CLI para sync |
| 9 | `backend/scripts/setup_credentials.py` | Setup seguro de credenciales |
| 10 | `database/seed/dev_data.sql` | Datos de prueba (doble guard) |

## Archivos a modificar (2)

| Archivo | Cambios |
|---------|---------|
| `backend/config/settings.py` | +ERP_ENCRYPTION_KEY, +SYNC_*, -CONTABILIUM_CLIENT_ID/SECRET |
| `.env.example` | +ERP_ENCRYPTION_KEY=, -CONTABILIUM_CLIENT_ID/SECRET |

## Dependencia nueva

```
cryptography>=42.0.0
```

---

## Componentes clave - Especificaciones

### ERPConnector (base.py)

```python
class ERPConnector(ABC):
    def test_connection(self) -> bool
    def fetch_customers(self) -> list[dict]
    def fetch_products(self) -> list[dict]
    def fetch_orders(self, since_date: date | None) -> list[dict]
```

Solo metodos de lectura. No existen _post(), _put(), _delete().

### ContabiliumConnector

- `authenticate()`: POST /token (unico POST, solo para OAuth2)
- `_get(endpoint)`: GET con Bearer token
- `_get_paginated()`: Loop de _get() hasta obtener todos
- `fetch_customers/products/orders()`: Implementaciones paginadas
- `__reduce__()`, `__getstate__()`: raise TypeError (no serializable)

Credenciales como `bytearray` (no `str`), limpieza explicita al salir del scope.

### TenantCredentials (crypto.py)

Context manager seguro para credenciales desencriptadas:
- Almacena client_secret como bytearray
- `__exit__`: sobreescribe memoria con ceros
- `__str__/__repr__`: retorna `***REDACTED***`
- `__copy__/__deepcopy__/__reduce__/__getstate__`: raise TypeError
- `load()` orden estricto: (1) fetch DB, (2) decrypt -> bytearray, (3) construccion con try/finally

### SyncEngine (sync.py) — 2 fases separadas + try/finally

```
1. Valida ERP_ENCRYPTION_KEY
2. Busca tenant -> erp_type
3. sync_log status='started'

try:
  FASE 1 — FETCH EXTERNO (fuera de transaccion DB):
  4. with TenantCredentials.load(slug) as creds:
     5. Crea conector
     6. test_connection()
     7. customers_data = fetch_customers()
     8. products_data = fetch_products()
     9. orders_data = fetch_orders(since_date)
  ← Credenciales limpiadas al salir del with (ANTES de transaccion DB)
  NOTA: --since solo filtra orders. Customers/products siempre completos
  (no tienen fecha de modificacion confiable en Contabilium).

  FASE 2 — UPSERT (dentro de transaccion DB):
  10. BEGIN: upsert customers, products, orders + campos derivados
  11. COMMIT + sync_log status='completed'

  POST-SYNC:
  12. findings = audit_logs_for_secrets(log_file) -> int
      Si findings > 0: sync_log status='requires_review'
      Si findings == 0: sin cambios (queda 'completed')

finally:
  13. try:  # TODO el contenido del finally en un UNICO try/except
          if sync_log.status == 'started': UPDATE a 'failed'
      except: logger.warning(...), NO re-raise (preserva excepcion original)
```

### Scripts CLI

```bash
# Sync
python backend/scripts/sync_erp.py --tenant-slug iey                    # Full
python backend/scripts/sync_erp.py --tenant-slug iey --test-only        # Solo test
python backend/scripts/sync_erp.py --tenant-slug iey --limit 5          # 5 por entidad
python backend/scripts/sync_erp.py --tenant-slug iey --since 2026-01-01 # Incremental

# Credenciales
python backend/scripts/setup_credentials.py --init              # Genera clave
python backend/scripts/setup_credentials.py --tenant-slug iey   # Carga credenciales
```

`--limit N` = N registros POR ENTIDAD (5 clientes + 5 productos + 5 ordenes).

---

## Matriz de seguridad

5 datos sensibles x 7 puntos de contacto = 35 celdas.

| | Logs | Memoria | DB | HTTP | Filesystem | Error paths | Serializacion |
|---|---|---|---|---|---|---|---|
| ERP_ENCRYPTION_KEY | OK | OK* | N/A | N/A | OK | OK | OK* |
| client_secret | OK | OK | OK | OK* | OK | OK | OK |
| access_token | OK | OK* | N/A | OK | N/A | OK | OK |
| PII clientes | OK | OK | OK | OK** | N/A | OK | N/A |
| DATABASE_PASSWORD | OK | OK* | N/A | N/A | OK | OK | OK* |

- OK = contrato verificable en codigo documentado
- OK* = limitacion conocida de Python (str inmutable, documentada)
- OK** = boundary (HTTPS, no reenviado)
- N/A = dato no pasa por ese punto

**Resumen:** 21 OK verificables, 7 OK aceptables, 7 N/A, 0 riesgos sin mitigar.

---

## Orden de implementacion

| Paso | Archivo | Dependencia |
|------|---------|-------------|
| 1 | `docs/CONTABILIUM_API.md` | Ninguna |
| 2 | Instalar cryptography + requirements.txt | Ninguna |
| 3 | `backend/engine/core/logger.py` | Ninguna |
| 4 | `backend/engine/connectors/crypto.py` | Paso 2 |
| 5 | `backend/engine/connectors/base.py` | Paso 3 |
| 6 | `backend/engine/connectors/contabilium.py` | Pasos 3-5 |
| 7 | `backend/engine/connectors/excel.py` | Pasos 3, 5 |
| 8 | `backend/engine/connectors/sync.py` | Pasos 3-7 |
| 9 | `backend/scripts/setup_credentials.py` | Paso 4 |
| 10 | `backend/scripts/sync_erp.py` | Paso 8 |
| 11 | Modificar settings.py + .env.example | Ninguna |
| 12 | `database/seed/dev_data.sql` | Ninguna |
| **13** | **Pato:** setup_credentials.py --init | Pasos 1-12 |
| **14** | **Pato:** setup_credentials.py --tenant-slug iey | Paso 13 |
| **15** | **Pato:** sync_erp.py --test-only | Paso 14 |
| **16** | **Pato:** sync_erp.py --limit 5 | Paso 15 OK |
| **17** | **Pato:** sync_erp.py (full) | Paso 16 OK |

Pasos 1-12: Codex implementa. Pasos 13-17: Pato ejecuta manualmente.

---

## Tests de verificacion (19)

| Test | Que verifica |
|------|-------------|
| 1 | Permisos .env = 600 |
| 2 | ERP_ENCRYPTION_KEY existe en .env |
| 3 | Credenciales encriptadas en DB (gAAAAAB...) |
| 4 | Conexion a Contabilium (--test-only) |
| 5 | Sync supervisado (--limit 5) |
| 6 | Sync completo |
| 7 | Datos en DB (count clientes, sync_log) |
| 8 | Auditoria automatica de logs post-sync (patron Bearer + Fernet en log → sync_log requires_review) |
| 9 | Guard del seed SQL (doble guard) |
| 10 | Permisos directorio logs = 700, archivos = 600 |
| 11 | Rotacion de logs (max 7 archivos) |
| 12A | Aislamiento multi-tenant (un solo tenant_id) |
| 12B | RLS habilitado en 6 tablas (pg_tables.rowsecurity = true) |
| 12C | Policies RLS activas en cada tabla (pg_policies, min 1 por tabla) |
| 13 | Rotacion de clave Fernet (encrypt/decrypt con nueva clave) |
| 13b | Rollback de rotacion fallida (3 tenants quedan con clave original) |
| 14 | Guard .gitignore en setup_credentials.py --init (Caso A: no existe + Caso B: sin .env) |
| 15 | Sync incremental --since con fecha futura (orders_synced = 0 exacto, verificacion inequivoca) |
| 16 | ExcelConnector rechaza columnas faltantes (ValueError descriptivo con hoja, faltantes, encontradas) |

---

## Riesgos mitigados (44)

Cada riesgo tiene mitigacion documentada y verificable. Lista completa en el plan detallado (`/home/pato/~/.codex/plans/gentle-riding-dijkstra.md`).

Riesgos criticos resueltos:
- Credenciales en texto plano -> Fernet encryption
- Tokens en logs -> SanitizingFormatter (arquitectonico)
- Traceback expone variables -> formatException() sobreescrito
- Loop infinito de auth -> Max 1 re-auth
- Seed en produccion -> Doble guard independiente
- .env no en .gitignore -> Guard en paso 0 de --init (Caso A: FileNotFoundError + Caso B: sin .env)
- Rollback de rotacion -> Test 13b verifica atomicidad (mock en encrypt_secret con patch location rule)
- RLS deshabilitado -> Test 12B verifica pg_tables + Test 12C verifica pg_policies
- bytearray→str en authenticate() -> Limitacion documentada, ventana microsegundos
- InvalidToken en rotacion de claves -> ValueError con tenant_slug, rollback total
- I/O externo dentro de transaccion DB -> SyncEngine 2 fases separadas
- Excel con columnas incorrectas -> test_connection() valida columnas minimas
- --since sin test dedicado -> Test 15 verifica filtro de fecha
- Campos de mapeo no verificados -> Columna [INFERIDO]/[CONFIRMADO] en tablas
- sync_log zombi (queda 'started' indefinidamente) -> try/finally en SyncEngine.run()
- Sync incremental descarga todos clientes/productos -> Decision documentada (sin fecha modificacion confiable)
- Datos de negocio en memoria entre fases -> <50MB para IEY, monitorear si escala

---

## Estado del proceso de revision

- 13 iteraciones de revision de seguridad
- AGENTS.md actualizado con 5 secciones de proceso y calibracion
- Matriz de seguridad: 35 celdas, 0 riesgos sin mitigar
- Plan detallado completo en: `/home/pato/~/.codex/plans/gentle-riding-dijkstra.md`

---

## Para la sesion de implementacion

1. Leer este documento completo ANTES de cualquier accion
2. Leer el plan detallado en `~/.codex/plans/gentle-riding-dijkstra.md` para especificaciones exactas
3. Seguir el orden de implementacion (pasos 1-12)
4. Cada archivo debe cumplir los contratos de seguridad documentados en la matriz
5. Despues de implementar, Pato ejecuta pasos 13-17 manualmente

---

## Infraestructura existente (de Fase 0)

- Tenant IEY: ID `b815e5d6-2ef0-4d27-999b-8a7642b71183`, erp_type=contabilium
- DB: PostgreSQL en Docker (172.18.0.10:5432, container `orion-menteax_postgres`)
- Python venv: `backend/venv/` (psycopg3, anthropic, pandas, requests, python-dotenv)
- `backend/engine/db/connection.py`: pool + tenant context (funcional)
- `backend/config/settings.py`: config desde .env
- 10 migraciones SQL ejecutadas (tablas listas)
- RLS habilitado en todas las tablas con tenant_id
