# Diseno: Sistema de Ingesta Multi-Canal

**Fecha:** 2026-02-24
**Estado:** Aprobado (brainstorming)
**Proximo paso:** Plan de implementacion

---

## Problema

PymePilot necesita datos frescos de ventas de cada cliente para generar
predicciones utiles. Hoy existen 2 canales: API de ERP (100% automatico)
y Excel manual (el cliente sube un archivo con formato predefinido).

**Limitaciones detectadas:**

1. **API no siempre disponible:** Muchos clientes no quieren dar acceso
   a su ERP por desconfianza/seguridad. Otros tienen ERPs sin API.
2. **Excel manual no escala:** Requiere que el cliente exporte multiples
   hojas en un formato especifico. Friccion alta, actualizacion irregular.
3. **Clientes sin ERP:** Manejan todo en Excel propio con formato libre.
   Actualizan "cuando pueden" — datos frecuentemente desactualizados.

**Hallazgo clave del brainstorming:** La mayoria de ERPs/factureros
permiten exportar UN reporte plano de ventas donde cada fila es una
linea de venta (cliente + fecha + producto + cantidad + monto). De ese
unico archivo, PymePilot puede derivar clientes, productos, ordenes e
items automaticamente.

**Segundo hallazgo:** Con solo 2 datos (cliente + fecha) PymePilot ya
aporta valor (frecuencia de compra, deteccion de inactivos, alertas de
contacto). Con 3 datos (+ producto) el valor es maximo (reposicion
predictiva, cross-sell).

---

## Diseno: 3 Canales de Ingesta

```
                    +----------------------------------+
                    |      PymePilot Ingest Engine      |
                    |   (Smart Parser + Merge Logic)    |
                    +-----------------+----------------+
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
        +-----+------+        +------+------+        +-------+------+
        |  Canal 1   |        |  Canal 2    |        |  Canal 3     |
        |  API ERP   |        |  Upload /   |        |  Carpeta     |
        | (auto 5AM) |        |  Email      |        |  Sync        |
        +------------+        +-------------+        +--------------+
         Ya existe             A construir            A construir
         Contabilium           Dashboard +            Google Drive /
                               incremental            Dropbox
```

### Canal 1: API del ERP (ya implementado)

- **Cliente tipo:** Tiene ERP con API y confia en dar acceso read-only.
- **Automatizacion:** 100% — sync diario a las 5 AM.
- **Calidad de datos:** Maxima — datos completos y estructurados.
- **Estado:** Implementado para Contabilium. Extensible a otros ERPs
  via la clase abstracta `ERPConnector` (patron Plugin).
- **Archivos:** `backend/engine/connectors/base.py`, `contabilium.py`,
  `sync.py`, `crypto.py`.

### Canal 2: Smart File Upload (a construir)

- **Cliente tipo:** Tiene ERP sin API, no quiere dar acceso API, o
  maneja sus ventas en Excel propio.
- **Flujo:**
  1. Cliente exporta reporte de ventas de su ERP/Excel (1 click).
  2. Sube al dashboard (drag & drop) o envia por email (futuro).
  3. Motor parsea cualquier formato automaticamente.
  4. Primera vez: mapeo supervisado (que columna es que). Despues:
     automatico (se guarda el mapeo por tenant).
  5. Preview de datos: "Encontre X clientes, Y ventas. Confirmas?"
  6. Ingesta.
- **Actualizacion incremental:** No reemplaza todo el historico cada
  vez. El cliente solo sube lo nuevo desde la ultima actualizacion.
  PymePilot hace merge inteligente con los datos existentes.
- **Automatizacion:** Semi-manual. El cliente exporta y sube.

**Sub-canal 2b: Email inbox (futuro)**

Cada tenant recibe un email dedicado (ej: `datos-slug@ingest.pymepilot.cloud`).
El cliente envia su export como adjunto. PymePilot lo procesa automaticamente.
Permite automatizacion via reglas de reenvio en el mail del cliente.

### Canal 3: Carpeta Sincronizada (a construir)

- **Cliente tipo:** Trabaja su Excel de ventas en Google Drive o Dropbox
  como parte de su rutina diaria.
- **Flujo:**
  1. Cliente comparte una carpeta con PymePilot (setup unico).
  2. PymePilot monitorea cambios en esa carpeta.
  3. Cada vez que el cliente guarda su Excel, PymePilot detecta el
     cambio, descarga el archivo, y re-procesa.
- **Automatizacion:** 100% — el cliente sigue su rutina normal
  (trabajar en su Excel). PymePilot se alimenta solo.
- **Friccion:** Cero despues del setup inicial.
- **Requiere:** Integracion con Google Drive API y/o Dropbox API.

---

## Capa Transversal: Motivacion y Calidad de Datos

Estos mecanismos aplican a los 3 canales y resuelven el problema de
que el cliente no actualiza sus datos con la frecuencia necesaria.

### Indicador de frescura en dashboard

El cliente ve en su dashboard la antiguedad de sus datos y como eso
impacta la precision de las predicciones:

```
+------------------------------------------------+
|  Tus datos tienen 12 dias de antiguedad         |
|                                                  |
|  Precision de predicciones: 73%                  |
|  Con datos frescos podria ser: 91%               |
|                                                  |
|  [Actualizar datos ahora]                        |
+------------------------------------------------+
```

**Objetivo:** Que el cliente entienda la CONSECUENCIA de no actualizar.
No es "subi tu Excel porque si", es "tus predicciones son peores".

### Notificaciones inteligentes

- Email y/o WhatsApp cuando los datos superan X dias sin actualizar.
- Frecuencia configurable por tenant.
- Mensaje: "Hace N dias que no actualizas tus datos. Tus predicciones
  estan perdiendo precision."

### Datos minimos viables

| Nivel | Datos disponibles | Valor que aporta PymePilot |
|-------|-------------------|---------------------------|
| Basico | Cliente + Fecha + Monto | Frecuencia de compra, inactivos, alertas de contacto |
| Completo | Cliente + Fecha + Producto + Cantidad + Monto | Todo lo anterior + reposicion predictiva, cross-sell |

**Principio:** Algo es mejor que nada. Si el cliente solo tiene datos
basicos, PymePilot igual le aporta valor. A medida que mejore sus
datos, el valor crece.

---

## Orden de Implementacion

| Prioridad | Que construir | Razon |
|-----------|---------------|-------|
| 1 | Canal 2: Upload en dashboard (drag & drop) | Ya tenemos frontend, bajo costo tecnico, cubre el caso mas comun |
| 2 | Indicador de frescura + notificaciones | Motiva al cliente a mantener datos actualizados |
| 3 | Upload incremental (merge de datos nuevos) | Reduce friccion de cada actualizacion |
| 4 | Canal 2b: Email inbox | Semi-automatiza el upload para clientes que prefieren email |
| 5 | Canal 3: Google Drive / Dropbox sync | Elimina friccion completamente. Game changer |

### Lo que ya existe y se reutiliza

- `ERPConnector` ABC y `SyncEngine` — el pipeline de ingesta ya esta.
- `ExcelConnector` — base para parseo de archivos. Se extiende con
  deteccion inteligente de columnas.
- Dashboard Next.js — ya tiene estructura para agregar pagina de upload.
- `sync_log` — ya registra cada sincronizacion con status y metricas.

---

## Decisiones de Negocio Tomadas

1. **PymePilot resuelve el problema de captura, no solo analisis.**
   Si el cliente no tiene buena forma de registrar ventas, PymePilot
   le da herramientas para que sus datos lleguen.

2. **El cliente no necesita dar acceso API para empezar.**
   Pitch comercial: "Exporta tus ventas y subilas. Nosotros hacemos
   el resto. Cuando veas los resultados, decides si automatizas."

3. **La confianza se construye con resultados.**
   Los 3 canales representan una escalera: upload manual (cero
   confianza) → carpeta compartida (algo de confianza) → API (confianza
   total). El cliente sube de nivel naturalmente.

4. **Datos minimos viables = cliente + fecha.**
   No rechazar clientes con datos incompletos. Dar valor parcial y
   que el cliente vea que con mejores datos, el valor crece.

---

## Riesgos Identificados

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| Cliente nunca actualiza datos | Predicciones inservibles | Indicador de frescura + notificaciones + mostrar impacto en precision |
| Formatos Excel muy dispares | Parser no puede interpretar | Motor entrenado para detectar formatos + mapeo supervisado primera vez |
| Google Drive API tiene rate limits | Sync interrumpido | Polling cada N horas (no real-time), respetar rate limits |
| Email inbox puede recibir spam | Archivos basura en el sistema | Validar remitente contra email registrado del tenant |
| Merge incremental genera duplicados | Datos corruptos | Dedup por hash de fila (cliente + fecha + monto) + external_id |

---

## Fuera de Alcance (por ahora)

- Construir un mini ERP / punto de venta dentro de PymePilot
- Integracion directa con AFIP
- Webhooks push desde ERPs (Nivel 4 de automatizacion)
- Sync real-time (se mantiene batch diario o por evento de upload)
