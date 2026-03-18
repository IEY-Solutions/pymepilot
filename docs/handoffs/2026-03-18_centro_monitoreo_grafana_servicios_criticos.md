# Handoff — Sesion 2026-03-18: Centro de Monitoreo Grafana + Servicios Criticos

## Resumen de sesion

Se completo la feature del **Centro de Monitoreo de PymePilot en Grafana** con una portada operativa orientada a lectura rapida.

El objetivo original era tener en una sola pantalla:
- salud del VPS
- espacio de disco y recursos base
- salud operativa de PymePilot
- estado de servicios criticos reales

La feature quedo funcionando y verificada manualmente en Grafana.

## Resultado final

### Dashboard principal

Se versiono y actualizo:

- `grafana/dashboards/pymepilot-centro-monitoreo.json`

El dashboard ahora muestra:

1. Fila superior:
   - `VPS reachable`
   - `Containers visibles`
   - `Prometheus collector`
   - `Ultimo orquestador`
   - `Ultimo sync ERP`
   - `Errores ultimas 24h`

2. Fila de servicios criticos:
   - `Postgres`
   - `Kong / API`
   - `Auth`
   - `Grafana`
   - `App PymePilot`
   - `Servicios criticos OK`

3. Infraestructura:
   - disco
   - RAM
   - CPU
   - load
   - uptime

4. Actividad Docker + salud de PymePilot:
   - CPU Docker total
   - memoria Docker total
   - predicciones hoy
   - costo Claude hoy

5. Historicos:
   - tendencia de disco
   - historial del orquestador
   - incidentes recientes

### Estado operativo verificado

Prometheus quedo con probes reales `up` para:

- `postgres`
- `kong`
- `auth`
- `grafana`
- `app`

Consulta verificada:

- `probe_success{service="postgres"} = 1`
- `probe_success{service="kong"} = 1`
- `probe_success{service="auth"} = 1`
- `probe_success{service="grafana"} = 1`
- `probe_success{service="app"} = 1`

## Causa raiz importante encontrada

Al principio los checks externos daban rojo no porque los servicios estuvieran caidos, sino porque `blackbox-exporter` estaba solo en la red Docker `internal`.

Eso le permitia llegar a `auth` y `postgres`, pero no resolver ni salir hacia URLs publicas como:

- `https://app.pymepilot.cloud`
- `https://devgrafana.menteax.com`
- `https://devapi.menteax.com/auth/v1/health`

La solucion aplicada fue **segura y minima**:

- mantener `blackbox-exporter` en `internal`
- agregar tambien `traefik-public`
- sin `privileged`
- sin puertos publicados
- sin mounts sensibles extra

## Cambios versionados en repo

- `docs/PROJECT_STATE.md`
- `grafana/dashboards/pymepilot-centro-monitoreo.json`
- `docs/handoffs/2026-03-18_centro_monitoreo_grafana_servicios_criticos.md`

## Cambios aplicados manualmente fuera del repo

Estos cambios viven en `/opt/orion-stack/` y fueron aplicados manualmente con `sudo` en el VPS:

- `docker-compose.yml`
  - agregado `node-exporter`
  - agregado `cadvisor`
  - agregado `blackbox-exporter`
  - `blackbox-exporter` unido a `internal` + `traefik-public`

- `configs/prometheus/prometheus.yml`
  - removidos jobs muertos previos
  - agregado scrape de `node`
  - agregado scrape de `cadvisor`
  - agregado jobs de blackbox:
    - `blackbox_http`
    - `blackbox_http_api`
    - `blackbox_tcp`
    - `blackbox_exporter`

- `configs/blackbox/blackbox.yml`
  - modulo `http_2xx`
  - modulo `http_api` con `valid_status_codes: [200, 401]`
  - modulo `tcp_connect`

## Importante para Claude Code

Si Claude Code quiere auditar el estado real, no alcanza con mirar el repo.
Tambien tiene que revisar la infraestructura viva en `/opt/orion-stack/`, porque parte del trabajo quedo aplicada manualmente en produccion/desarrollo.

## Validaciones hechas

- JSON del dashboard validado con `python3 -m json.tool`
- layout revisado para evitar superposiciones
- targets activos de Prometheus revisados
- probes `probe_success` verificados en Prometheus
- importacion del dashboard hecha en Grafana
- overwrite hecho en Grafana
- Pato confirmo visualmente que el dashboard quedo bien

## Commits relevantes

- Commit previo de base del centro de monitoreo:
  - `41ffff8` — `feat: add grafana monitoring center dashboard`

- Esta sesion agrega:
  - servicios criticos reales
  - ajuste final del dashboard
  - handoff

## Siguientes mejoras opcionales

Nada de esto bloquea la feature. Son mejoras posibles:

1. Alertas activas por Telegram o email cuando un probe pase a `0`
2. Thresholds mas finos para disco, RAM y costo Claude
3. Dashboard de detalle por servicio
4. Versionar tambien la config de `/opt/orion-stack/` en algun repo de infraestructura

## Estado final

**Feature terminada como V1 operativa.**

Sirve para detectar rapido:
- caida de VPS/monitoreo
- problema de recursos
- problema de base
- problema de gateway/API
- problema de auth
- problema de Grafana
- caida real de la app
- fallas operativas de PymePilot
