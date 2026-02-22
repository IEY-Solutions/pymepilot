# Pendiente: Sync real con Contabilium API

**Creado:** 2026-02-22
**Bloqueante para:** Cierre de Fase 1 (tarea 1.7)
**Prioridad:** Ejecutar apenas Contabilium responda al ticket

---

## Contexto

El codigo de conexion a Contabilium esta 100% listo y testeado.
El unico bloqueo es que Cloudflare devuelve 403 desde la IP del VPS
(173.249.9.56). Se envio ticket a soporte de Contabilium pidiendo
whitelist de esa IP.

## Que hay que hacer cuando respondan

### Paso 1: Verificar que la IP fue whitelisteada

```bash
# Desde el VPS:
curl -s -o /dev/null -w "%{http_code}" https://rest.contabilium.com/api/
```

- Si devuelve **200** o **401** → IP desbloqueada, seguir al paso 2
- Si devuelve **403** → Cloudflare sigue bloqueando, responder al ticket

### Paso 2: Test de conexion (sin sincronizar datos)

```bash
source backend/venv/bin/activate
python backend/scripts/sync_erp.py --tenant-slug iey --test-only
```

Esto hace: desencripta credenciales → pide access_token a Contabilium → verifica conexion.

- Si dice "test_connection(): OK" → seguir al paso 3
- Si falla con error de credenciales → las credenciales ya estan cargadas
  en la DB (setup_credentials.py se ejecuto el 2026-02-22), pero si
  Contabilium las revoco, re-ejecutar:
  ```bash
  python backend/scripts/setup_credentials.py --tenant-slug iey
  ```

### Paso 3: Sync limitado (5 registros por entidad)

```bash
python backend/scripts/sync_erp.py --tenant-slug iey --limit 5
```

Verificar en la DB:
```bash
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "
SELECT 'clientes' as t, COUNT(*) FROM customers WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
UNION ALL SELECT 'productos', COUNT(*) FROM products WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
UNION ALL SELECT 'ordenes', COUNT(*) FROM orders WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
UNION ALL SELECT 'items', COUNT(*) FROM order_items WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183';
"
```

### Paso 4: Sync completo

```bash
python backend/scripts/sync_erp.py --tenant-slug iey
```

### Paso 5: Limpiar datos de prueba Excel (opcional)

Los datos del Excel (external_ids 3001-3020, 4001-4010, 5001-5030)
conviven con los datos reales sin conflicto (external_ids diferentes).
Si se quieren eliminar para tener solo datos reales:

```sql
-- CUIDADO: ejecutar solo despues de verificar sync real exitoso
DELETE FROM order_items WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND order_id IN (SELECT id FROM orders WHERE external_id LIKE '5%');
DELETE FROM orders WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND external_id LIKE '5%';
DELETE FROM customers WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND external_id LIKE '3%';
DELETE FROM products WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND external_id LIKE '4%';
-- Tambien los del seed:
DELETE FROM customers WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND external_id LIKE '1%';
DELETE FROM products WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  AND external_id LIKE '2%';
```

---

## Archivos relevantes

- `backend/engine/connectors/contabilium.py` — el conector (listo)
- `backend/engine/connectors/crypto.py` — encriptacion de credenciales
- `backend/scripts/setup_credentials.py` — CLI para cargar credenciales
- `backend/scripts/sync_erp.py` — CLI para ejecutar sync
- `docs/CONTABILIUM_API.md` — documentacion de la API
- `docs/handoffs/2026-02-22_implementacion_fase1.md` — handoff de la sesion

## Credenciales IEY

- Ya cargadas y encriptadas en la DB (tabla tenants.erp_config)
- client_id: agustinmorales@ieyoficial.com
- client_secret: encriptado con Fernet (ERP_ENCRYPTION_KEY en .env)
- Verificadas OK desde PC de Pato (Windows) el 2026-02-22
