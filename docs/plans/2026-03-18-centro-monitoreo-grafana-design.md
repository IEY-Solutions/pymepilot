# Design Doc — Centro de Monitoreo Grafana

**Fecha:** 2026-03-18
**Estado:** Aprobado
**Prerequisito:** Grafana y Prometheus ya desplegados, dashboards actuales operativos
**Enfoque elegido:** Hibrido — integrar sobre lo existente sin romperlo, y dejar el resultado final versionado y documentado

---

## Objetivo

Crear un dashboard principal en Grafana que funcione como centro de monitoreo
de PymePilot, con lectura rapida en menos de 10 segundos.

La pantalla debe priorizar:

1. Caida del VPS o de containers criticos
2. Riesgo por falta de espacio en disco
3. Salud operativa de PymePilot

El dashboard NO reemplaza los dashboards actuales. Los reutiliza como vistas
de detalle.

---

## Criterios de exito

1. Existe un dashboard principal `PymePilot — Centro de Monitoreo`
2. La primera fila permite detectar rapidamente si la plataforma esta caida
3. El estado de disco queda visible sin navegar a otros dashboards
4. La salud de PymePilot queda visible usando metricas agregadas seguras
5. Cada metrica importante tiene una explicacion corta, visible o muy cercana
6. El dashboard final queda exportado al repo y documentado

---

## Estado actual verificado

### Lo que ya existe

- Grafana y Prometheus estan desplegados en el stack Docker
- Existen 2 dashboards versionados:
  - `PymePilot — Operaciones`
  - `PymePilot — Costos Claude`
- Grafana ya lee metricas de PymePilot desde PostgreSQL via 4 VIEWs seguras:
  - `monitoring_operations`
  - `monitoring_costs`
  - `monitoring_syncs`
  - `monitoring_predictions`

### Gap real

El repo no muestra instrumentacion de infraestructura del VPS y containers.
Por eso el nuevo centro de monitoreo debe auditar primero el setup actual de
Prometheus antes de agregar exporters o dashboards nuevos.

---

## Opciones consideradas

### Opcion A — Dashboard unico rapido sobre lo existente

**Descripcion:** Crear solo el dashboard principal y reutilizar al maximo lo
que ya esta montado.

**Pros:**
- Menor riesgo sobre el setup vivo
- Implementacion mas rapida
- Aprovecha dashboards existentes

**Contras:**
- Puede quedar parte del setup solo en la UI
- Menor reproducibilidad

### Opcion B — Reordenar todo el stack de monitoreo desde cero

**Descripcion:** Rehacer datasources, exporters y dashboards con provisioning
completo.

**Pros:**
- Resultado muy prolijo y completamente reproducible

**Contras:**
- Riesgo innecesario sobre un sistema ya operativo
- Mas tiempo y mas superficie de falla

### Opcion elegida — Hibrido

Se usa la logica de la opcion A para no romper lo que ya funciona, pero el
resultado final se cierra con criterio de la opcion B: dashboard versionado,
documentacion clara y pasos de integracion explicitados.

---

## Diseño funcional

### Prioridad de lectura

La pantalla principal se ordena por impacto operativo:

1. Infraestructura critica
2. Capacidad del servidor
3. Salud de PymePilot
4. Contexto historico corto

### Containers criticos del proyecto

Estos servicios deben aparecer como indicadores prioritarios:

- `orion-menteax_postgres`
- `traefik`
- `orion-menteax_kong`
- `orion-menteax_rest`
- `orion-menteax_auth`
- `pymepilot-dashboard`

Servicios importantes pero no criticos para la operacion principal:

- `orion-menteax_grafana`
- `orion-menteax_prometheus`
- `orion-menteax_storage`

---

## Layout propuesto

### Fila 1 — Estado critico

- `Plataforma general`
- `Postgres`
- `Traefik`
- `Kong`
- `PostgREST`
- `Auth`
- `PymePilot Dashboard`

**Objetivo:** responder rapido si el sistema esta vivo o si hay un incidente.

### Fila 2 — Infraestructura del VPS

- `Uso de disco /`
- `Disco libre en GB`
- `RAM usada`
- `CPU promedio 5m`
- `Load average`
- `Uptime del host`

**Objetivo:** detectar saturacion del servidor antes de que afecte la app.

### Fila 3 — Containers auxiliares

- `Grafana`
- `Prometheus`
- `Storage`
- `Containers caidos o reiniciando`

**Objetivo:** separar problemas de observabilidad de problemas del negocio.

### Fila 4 — Salud PymePilot

- `Ultimo run del orquestador`
- `Ultimo sync ERP`
- `Errores recientes`
- `Predicciones generadas hoy`
- `Costo Claude hoy`
- `Tokens Claude hoy`

**Objetivo:** verificar si la aplicacion esta ejecutando su trabajo normal.

### Fila 5 — Timeline corto

- `Historial de runs del orquestador`
- `Historial de syncs`
- `Reinicios de containers`
- `Tendencia de uso de disco`

**Objetivo:** sumar contexto rapido sin convertir el dashboard en un informe.

---

## Catalogo de metricas y fuente de datos

### Fuente 1 — Prometheus

Se usa para infraestructura del host y containers.

#### Host Linux

Fuente esperada: `node_exporter`.

- `VPS online`
  - Que muestra: si Prometheus sigue pudiendo leer metricas del servidor
- `CPU promedio 5m`
  - Que muestra: carga reciente del procesador
- `RAM usada`
  - Que muestra: memoria ocupada en este momento
- `Uso de disco /`
  - Que muestra: porcentaje ocupado del disco principal
- `Disco libre en GB`
  - Que muestra: espacio real disponible antes de riesgo operativo
- `Load average`
  - Que muestra: cantidad de tareas compitiendo por recursos
- `Uptime del host`
  - Que muestra: tiempo desde el ultimo reinicio del VPS

#### Containers Docker

Fuente esperada: `cAdvisor` o equivalente ya existente.

- `Estado de containers criticos`
  - Que muestra: si cada servicio sigue corriendo
- `Reinicios por container`
  - Que muestra: si algun servicio entra en loop
- `CPU por container`
  - Que muestra: que servicio consume mas procesador
- `RAM por container`
  - Que muestra: que servicio consume mas memoria

### Fuente 2 — PostgreSQL

Se usa para salud operativa de PymePilot, reusando VIEWs seguras ya
existentes.

- `monitoring_operations`
  - Para: ultimo orquestador, historial de runs, errores
- `monitoring_syncs`
  - Para: ultimo sync ERP e historial de syncs
- `monitoring_predictions`
  - Para: predicciones generadas hoy
- `monitoring_costs`
  - Para: tokens y costo Claude

### Fuente 3 — Fase futura opcional

`Blackbox exporter` o chequeo HTTP externo.

Uso futuro:
- verificar que `app.pymepilot.cloud` responde desde afuera
- verificar que `grafana.menteax.com` responde desde afuera

Esto queda fuera de la primera implementacion.

---

## Explicaciones por metrica

Cada panel importante debe incluir una explicacion corta para lectura no
tecnica. Se prioriza texto breve siempre visible o muy cercano al panel.

Ejemplos:

- `Uso de disco /`
  - `Que muestra: porcentaje ocupado del disco principal del servidor`
- `Ultimo run del orquestador`
  - `Que muestra: si la ejecucion diaria principal termino bien o fallo`
- `Errores recientes`
  - `Que muestra: cantidad de fallos registrados en la operacion reciente`

Si Grafana no permite texto siempre visible con buena legibilidad en todos los
paneles elegidos, se acepta combinacion de:

1. descripcion de panel
2. panel de texto corto al inicio del dashboard
3. nombres de panel mas explicativos

---

## Navegacion y convivencia con dashboards existentes

El nuevo dashboard se convierte en portada operacional.

Los dashboards actuales quedan como detalle:

- `PymePilot — Operaciones`
- `PymePilot — Costos Claude`

El dashboard principal debe incluir links a esos dashboards para drilldown.

---

## Seguridad

### Principios

- No exponer datos de clientes
- No exponer credenciales
- No exponer logs crudos con contenido sensible
- Mantener el principio de minimo privilegio ya usado por `grafana_reader`

### Aplicacion practica

- La salud de PymePilot sigue saliendo de VIEWs agregadas seguras
- La parte de servidor usa metricas tecnicas, no datos de negocio
- Si se agregan exporters, no deben incluir secrets en labels o nombres

---

## Trabajo final esperado

El trabajo bien hecho se divide en 5 pasos:

1. Auditar el estado actual de Grafana y Prometheus
2. Definir como integrar el dashboard nuevo sin romper lo existente
3. Construir el dashboard principal
4. Validar lectura de estados criticos y fuentes de datos
5. Versionar y documentar el resultado

---

## Fuera de alcance inicial

- Rehacer todo el stack de monitoreo
- Reemplazar dashboards actuales
- Configurar alertas activas por email o Telegram
- Agregar blackbox monitoring externo

Esos puntos pueden entrar en una segunda etapa.

---

## Riesgos y mitigaciones

### Riesgo 1 — Prometheus ya existe pero no scrapea host/containers

**Mitigacion:** auditar targets actuales antes de tocar configuracion.

### Riesgo 2 — Parte del setup vive solo en la UI de Grafana

**Mitigacion:** exportar el dashboard final al repo y documentar datasource,
UIDs y dependencias.

### Riesgo 3 — Mezclar demasiada informacion en una sola pantalla

**Mitigacion:** mantener arriba solo estados y gauges; dejar historia abajo.

### Riesgo 4 — Confusion para usuarios no tecnicos

**Mitigacion:** agregar explicaciones cortas por metrica importante.

---

## Validacion

Antes de dar por terminada la feature:

1. El dashboard responde rapido si un container critico cae
2. El dashboard muestra con claridad el estado del disco
3. Las metricas de PymePilot siguen saliendo de fuentes seguras
4. El JSON final esta guardado en el repo
5. La documentacion explica de donde sale cada bloque

---

## Definicion de terminado

La feature se considera terminada cuando exista un dashboard principal usable
como portada de monitoreo, conectado a fuentes reales, versionado en el repo y
documentado sin romper dashboards actuales.
