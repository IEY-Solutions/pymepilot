# Diseño: Smart File Upload v2 — Parseo Inteligente con Claude

**Fecha:** 2026-02-24
**Estado:** Aprobado
**Reemplaza:** `2026-02-24-smart-file-upload-plan.md` (plantilla fija, descartado)
**Origen:** Brainstorming en sesion 2026-02-24

---

## Contexto y motivacion

PymePilot necesita un canal de ingesta para distribuidores que NO tienen ERP
con API. Estos distribuidores manejan todo en Excel con formatos propios.

**Principio clave:** Cero friccion para el usuario. El cliente sube SU Excel
tal cual lo tiene — PymePilot se adapta al formato, no al reves.

**Cambio vs plan original:** El plan v1 requeria una plantilla fija que el
usuario llenaba. Pato lo descarto: "no puede haber friccion en hacerle
completar un excel desde 0".

---

## Decisiones de diseno

### 1. Claude analiza y mapea columnas automaticamente

El worker Python lee headers + primeras 5 filas de cada hoja y se las manda
a Claude. Claude devuelve un JSON con el mapeo de columnas al formato interno.

**Por que Claude y no reglas heuristicas:** Claude entiende contexto y
sinonimos ("Razon Social", "Nombre Empresa", "Company" → name). Las reglas
requieren mantener listas de sinonimos que siempre quedan incompletas.

**Costo:** ~$0.003-0.008 por upload (< 1 centavo). Insignificante.

### 2. Soporte multi-archivo

El usuario puede subir 1 o mas archivos en un mismo upload. Ejemplo:
- Un archivo con clientes y otro con ventas
- O un solo archivo con todo mezclado

Todos los archivos se analizan juntos en una sola llamada a Claude.

### 3. Hojas mixtas (caso mas comun)

Muchos distribuidores tienen una unica hoja con todo:
```
Fecha | Cliente | Producto | Cant | Precio | Total
```

El SmartFileConnector sabe extraer entidades separadas de hojas mixtas:
- `fetch_customers()` → valores unicos de columna "cliente"
- `fetch_products()` → valores unicos de columna "producto"
- `fetch_orders()` → filas agrupadas como ordenes

### 4. Datos minimos

- **Ideal:** Ventas con cliente, fecha, producto, cantidad, precio
- **Minimo viable:** Cliente + fecha de compra (suficiente para frecuencia de reposicion)
- No es obligatorio subir las 3 entidades por separado

### 5. SyncEngine NO se modifica

Se usa `SyncEngine.run(connector_override=smart_connector, source_override='upload')`
que ya existe y funciona desde Fase 1.

---

## Flujo completo

```
USUARIO → Arrastra 1-N Excel al dashboard
FRONTEND → Upload a Storage (bucket privado) + INSERT upload_job(status=pending)
FRONTEND → Polling cada 5s para ver el status
WORKER → Cron cada 1min, toma job pendiente (FOR UPDATE SKIP LOCKED)
WORKER → Descarga archivos de Storage
WORKER → Lee headers + 5 filas de muestra por hoja
WORKER → Llama a Claude: "mapea estas columnas"
CLAUDE → Responde JSON con mapeo estructurado
WORKER → Crea SmartFileConnector con el mapeo
WORKER → SyncEngine.run(connector_override=smart_connector)
WORKER → Actualiza job a completed/failed
FRONTEND → Ve el resultado en el polling
```

---

## Claude: prompt y respuesta esperada

### Input a Claude (solo headers + muestra, NUNCA datos completos)
```
Analiza estos datos de un Excel subido por un distribuidor mayorista.
Por cada hoja, identifica que tipo de datos contiene y mapea las columnas.

ARCHIVO: ventas_enero.xlsx
HOJA: Hoja1
HEADERS: Fecha | Cliente | Producto | Cant | Precio Unit | Total
MUESTRA (5 filas):
  2026-01-15 | Dist. Sur | MagSafe 15W | 3 | 25000 | 75000
  ...
```

### Output de Claude (JSON estructurado)
```json
{
  "sheets": [
    {
      "file": "ventas_enero.xlsx",
      "sheet": "Hoja1",
      "entity_type": "mixed_sales",
      "column_mapping": {
        "Fecha": "order_date",
        "Cliente": "customer_name",
        "Producto": "product_name",
        "Cant": "quantity",
        "Precio Unit": "unit_price",
        "Total": "total_price"
      }
    }
  ]
}
```

### Entity types reconocidos
- `customers` — solo clientes
- `products` — solo productos
- `orders` — ordenes (con referencia a cliente por ID/nombre)
- `order_items` — detalle de items (con referencia a orden)
- `mixed_sales` — todo junto en una hoja (caso mas comun)

### Si Claude falla
- 1 retry
- Si sigue fallando → job `failed` con mensaje claro para el usuario

---

## Archivos a crear (4 nuevos)

| Archivo | Que es |
|---------|--------|
| `database/migrations/018_create_upload_jobs.sql` | Tabla upload_jobs + bucket Storage + RLS |
| `database/migrations/018_rollback.sql` | Rollback de la migracion |
| `backend/engine/connectors/smart.py` | SmartFileConnector (implementa ERPConnector) |
| `backend/scripts/process_uploads.py` | Worker Python (cron cada 1 min) |
| `frontend/src/components/upload/file-upload.tsx` | Componente drag-and-drop multi-archivo |

## Archivos a modificar (2, cambios minimos)

| Archivo | Cambio |
|---------|--------|
| `backend/config/settings.py` | +2 variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `frontend/src/app/(dashboard)/datos/page.tsx` | Integrar upload + indicador frescura mejorado |

## Archivos que NO se tocan

| Archivo | Razon |
|---------|-------|
| `backend/engine/connectors/excel.py` | Funciona tal cual |
| `backend/engine/connectors/sync.py` | SyncEngine intacto, se usa via connector_override |
| `backend/engine/connectors/base.py` | ERPConnector ABC intacta |
| `backend/engine/connectors/contabilium.py` | Canal 1 intacto |
| `backend/engine/claude/client.py` | Se reutiliza para el analisis |
| `database/migrations/001-017` | Todas intactas |
| Frontend existente (KPIs, Contactar, etc.) | Intacto |

---

## Seguridad

- **Archivos:** Bucket privado, 10MB max, solo .xlsx, RLS por tenant
- **Datos a Claude:** Solo headers + 5 filas de muestra, NUNCA datos completos
- **Archivos temporales:** /tmp/ con umask 0o077, eliminados en finally
- **SERVICE_ROLE_KEY:** Solo en .env, capturada por SanitizingFormatter
- **Procesamiento:** FOR UPDATE SKIP LOCKED (sin duplicados)
- **Multi-tenant:** RLS en upload_jobs + Storage policies por tenant_id
- **Excel malicioso:** openpyxl read_only=True, data_only=True (sin macros)

---

## Post-MVP (NO en esta iteracion)

- Upload incremental (merge sin reemplazar historico)
- Preview del mapeo antes de procesar ("detectamos estas columnas, confirmas?")
- Soporte CSV ademas de Excel
- Email inbox para recibir archivos
