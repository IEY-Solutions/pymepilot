# Plan de Implementacion — Centro de Monitoreo Grafana

**Fecha:** 2026-03-18
**Design doc:** `2026-03-18-centro-monitoreo-grafana-design.md`
**Sesiones estimadas:** 2-3 sesiones

---

## Sesion 1 — Auditoria del estado actual

**Objetivo:** entender exactamente como esta montado hoy Grafana para integrar
el nuevo dashboard sin romper lo que ya existe.

### Paso 1: Auditar dashboards y datasources actuales

- Verificar dashboards existentes en Grafana
- Confirmar UID(s) de datasources usados por los dashboards actuales
- Confirmar si el datasource Prometheus ya existe y esta sano
- Confirmar carpetas, naming y convenciones actuales

### Paso 2: Auditar Prometheus

- Revisar targets actuales
- Verificar si ya existe scrape de host Linux
- Verificar si ya existe scrape de containers Docker
- Confirmar si hay `node_exporter`, `cAdvisor` o equivalente

### Paso 3: Mapear metrica por metrica

- Marcar cuales paneles del nuevo dashboard ya tienen fuente real
- Marcar cuales requieren agregar exporters o targets
- Separar bloque `host`, bloque `containers`, bloque `PymePilot`

### Paso 4: Definir integracion sin ruptura

- Mantener `PymePilot — Operaciones`
- Mantener `PymePilot — Costos Claude`
- Crear `PymePilot — Centro de Monitoreo` como portada
- Definir links desde la portada a los dashboards de detalle

### Entregable de la sesion

- Inventario del estado actual
- Lista exacta de metricas disponibles y faltantes
- Decision sobre si hace falta tocar Prometheus

---

## Sesion 2 — Construccion del dashboard principal

**Objetivo:** crear el dashboard unificado con foco en lectura rapida.

### Paso 1: Crear layout base

- Fila 1: estado critico
- Fila 2: infraestructura del VPS
- Fila 3: containers auxiliares
- Fila 4: salud PymePilot
- Fila 5: timeline corto

### Paso 2: Conectar metricas de infraestructura

- Agregar paneles de host
- Agregar paneles de containers criticos
- Agregar paneles auxiliares
- Configurar thresholds verde/amarillo/rojo

### Paso 3: Conectar metricas PymePilot

- Reusar `monitoring_operations`
- Reusar `monitoring_syncs`
- Reusar `monitoring_predictions`
- Reusar `monitoring_costs`

### Paso 4: Agregar explicaciones cortas

- Ajustar nombres de panel
- Agregar descripciones de panel
- Si hace falta, sumar panel de texto corto con leyenda general

### Paso 5: Agregar navegacion

- Links al dashboard de operaciones
- Links al dashboard de costos

### Entregable de la sesion

- Dashboard funcional en Grafana
- Lectura rapida util para incidentes

---

## Sesion 3 — Versionado, validacion y documentacion

**Objetivo:** dejar el resultado mantenible y reproducible.

### Paso 1: Exportar dashboard final

- Exportar JSON final desde Grafana
- Guardarlo en `grafana/dashboards/`
- Revisar que no incluya datos sensibles

### Paso 2: Documentar

- Explicar fuentes de datos usadas
- Explicar metricas clave
- Explicar si existe dependencia externa no versionada

### Paso 3: Validacion operativa

- Revisar lectura de estados criticos
- Revisar claridad de disco y capacidad
- Revisar salud de PymePilot
- Revisar links a dashboards de detalle

### Paso 4: Cierre

- Actualizar `docs/PROJECT_STATE.md`
- Registrar limitaciones o segunda etapa

### Entregable de la sesion

- Dashboard versionado
- Documentacion lista
- Estado del proyecto actualizado

---

## Checklist tecnico

- [ ] Grafana actual auditado
- [ ] Prometheus actual auditado
- [ ] Datasource PostgreSQL confirmado
- [ ] Datasource Prometheus confirmado o creado
- [ ] Metricas de host disponibles
- [ ] Metricas de containers disponibles
- [ ] Dashboard principal creado
- [ ] Explicaciones cortas agregadas
- [ ] JSON exportado al repo
- [ ] Documentacion actualizada

---

## Riesgos de implementacion

- Si Prometheus no scrapea host/containers, la feature requiere tocar infra
- Si el datasource Prometheus no existe, hay que configurarlo antes del dashboard
- Si el dashboard se arma solo en UI y no se exporta, se pierde mantenibilidad

---

## Criterio operativo

Primero integrar sobre lo ya vivo. Despues dejar el resultado limpio y
versionado. No reestructurar el stack completo salvo que la auditoria muestre
un bloqueo real.
