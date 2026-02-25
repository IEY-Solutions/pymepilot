# Handoff: Fase 1 Completada — Sync Contabilium Operativo

**Fecha:** 2026-02-25
**Sesión:** Conexión real a Contabilium API + auditoría
**Commits:** `fbba679` (feat), `7c9a4ab` (audit fixes)

---

## Resumen

Contabilium habilitó la IP del VPS en su whitelist. Se completó la conexión
real al ERP y se verificó el flujo end-to-end con datos reales de IEY.

**Fase 1 pasa de 90% a 95%.** El código está completo y probado. Solo falta
ejecutar el sync full (sin `--limit`) cuando Pato lo decida.

---

## Qué se hizo en esta sesión

### 1. Conexión IPv4 resuelta
- **Problema:** VPS (Contabo) prefería IPv6, pero Contabilium solo whitelisteó IPv4.
- **Fix:** `IPv4HTTPAdapter` (Transport Adapter) fuerza `socket.AF_INET` en urllib3.
- **Resultado:** Token obtenido, GET 200 a todos los endpoints.

### 2. Descubrimiento de endpoints correctos
- `comprobantes/search` (NO `ordenesVenta/search` que mezclaba canales)
- `comprobantes/?id=XXX` para detalle con Items
- `clientes/?id=XXX` para descarga dirigida de clientes

### 3. Filtro por punto de venta mayorista (PV 0003)
- **Problema:** La API devuelve TODOS los datos (5000+ clientes, 33000+ comprobantes
  de todos los canales: MercadoLibre, TiendaNube, mayorista).
- **Solución:** Filtro `0003-` en comprobantes/search + post-filtro por Numero.
- **Tipos incluidos:** FCA (factura A), FCB (factura B), COT (cotización = venta no facturada).
- **Excluidos:** NCA/NCB (notas de crédito = devoluciones).
- **Resultado:** 279 comprobantes del PV 0003, ~277 ventas después de excluir NC.

### 4. Descarga dirigida de clientes
- **Problema:** `clientes/search` devuelve 5000+ clientes (todos los canales).
- **Solución:** Extraer `IdCliente` únicos de los comprobantes (~138) y descargar
  cada uno por ID (`clientes/?id=XXX`).
- **Cambio en sync.py:** Orden invertido — órdenes primero, luego clientes dirigidos.

### 5. Limit eficiente
- **Antes:** `--limit 5` descargaba TODOS los registros y recortaba al final.
- **Ahora:** `_get_paginated` acepta `limit` y corta la paginación apenas tenga suficientes.
- Propagado a todos los conectores: base.py, contabilium.py, excel.py, smart.py.

### 6. Parsers de datos argentinos
- `_parse_iso_date()`: Fechas ISO `2025-03-12T00:00:00` → `date` de Python.
- `_parse_argentine_money()`: Montos `"47.341,01"` → `float` 47341.01.

### 7. Test E2E exitoso (--limit 5)
```
Comprobantes PV 0003:     279 obtenidos, 2 NC excluidas
Ordenes procesadas:       5 (con Items detallados)
Clientes descargados:     5 (solo los de esas órdenes)
Productos descargados:    5
Upsert clientes:          5 ✓
Upsert productos:         5 ✓
Upsert ordenes:           5 ✓ (antes era 0 porque clientes no coincidían)
```

---

## Auditoría de seguridad

**Veredicto:** APROBADO — 0 CRITICAL, 0 HIGH

### Fixes aplicados (commit `7c9a4ab`)

| ID | Sev | Fix |
|----|-----|-----|
| M-03 | MED | ExcelConnector con límite 50k filas (protección OOM) |
| L-01 | LOW | Quitar mount http:// (solo HTTPS) |
| M-02 | MED | Sanitizar excepciones con sanitize_text() |
| L-05 | LOW | Sanitizar error en sync_erp.py |

### Hallazgos deferred (sin riesgo práctico hoy)

| ID | Sev | Descripción | Cuándo resolver |
|----|-----|-------------|-----------------|
| M-01 | MED | IPv4 patch es module-level en urllib3 | Cuando haya otro HTTP client |
| M-04 | MED | conninfo usa f-string con password | Cuando se refactoree connection.py |
| L-03 | LOW | `_PV_MAYORISTA = '0003-'` hardcoded | Cuando haya 2do tenant |
| L-04 | LOW | `_COMPROBANTE_TIPOS_VENTA` hardcoded | Si Contabilium agrega tipos |

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `backend/engine/connectors/contabilium.py` | IPv4 adapter, comprobantes PV 0003, fetch dirigido, parsers |
| `backend/engine/connectors/base.py` | `client_ids` en fetch_customers, `limit` en todos |
| `backend/engine/connectors/excel.py` | `client_ids` param, MAX_ROWS_PER_SHEET |
| `backend/engine/connectors/smart.py` | `client_ids` param |
| `backend/engine/connectors/sync.py` | Orden invertido (órdenes→clientes→productos) |
| `backend/config/settings.py` | Removido CONTABILIUM_VENDEDOR_FILTER |
| `backend/scripts/sync_erp.py` | sanitize_text en error handler |

---

## Pendiente para completar 100% de Fase 1

### Sync full (sin --limit)
```bash
source backend/venv/bin/activate
python backend/scripts/sync_erp.py --tenant-slug iey
```
- **Estimado:** ~5-7 minutos (6 páginas search + ~277 GETs detalle + ~138 GETs clientes)
- **Resultado esperado:** ~277 comprobantes, ~138 clientes, ~2000 productos

### Limpiar datos de prueba (opcional, post-sync full)
Los datos del Excel/seed (external_ids `su_*`, `3xxx`, `4xxx`, `5xxx`) conviven
sin conflicto con los datos reales de Contabilium.

---

## Datos útiles para Fase 4

- **IDVendedor mayorista:** 27438 (Patricio Galván)
- **PuntoVenta ID interno:** 120954 (PV 0003)
- **Clientes mayoristas únicos:** ~138
- **IEY tiene 5000+ clientes totales** (pero solo sincronizamos mayoristas)
- **Contabilium NO distingue canales** en clientes/productos — solo en comprobantes via Numero
- **Crontab actual:** backup 3AM, uploads 1min, drive 4:30AM, freshness 5:30AM
