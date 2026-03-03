# Design Doc — Fase 9: Pulido y Produccion

**Fecha:** 2026-03-03
**Estado:** Aprobado
**Prerequisito:** Fases 0-8 completadas y auditadas (0C/0H)
**Enfoque elegido:** A — Grafana directo a PostgreSQL

---

## Objetivo

Convertir el MVP operativo en un sistema de produccion monitoreado,
limpio, y documentado. Tres pilares: (1) monitoreo con dashboards
Grafana, (2) resolucion de deuda tecnica acumulada, (3) documentacion
actualizada.

## Criterios de exito

1. `devgrafana.menteax.com` muestra si el sistema corrio hoy y cuanto costo
2. 0 MEDIUMs pendientes de auditorias anteriores
3. Documentacion refleja la realidad del sistema
4. Auditoria final: 0 CRITICAL, 0 HIGH

---

## Protocolos de seguridad y desarrollo aplicables

> Extraidos de CLAUDE.md. Se aplican a TODA implementacion de esta fase.
> NO se evalua si aplican — se ejecutan (Regla Madre 1).

### Protocolo post-modificacion de codigo (OBLIGATORIO)

Cada vez que se use Edit o Write sobre .py, .sql, .ts, .tsx, .jsx:

1. **Identificar dependencias:** Listar archivos que importan/dependen del modificado
2. **Verificar consistencia:** imports, firmas, tipos, columnas DB, contratos
3. **Ejecucion mental 3 escenarios:** (A) happy path, (B) excepcion primera linea, (C) excepcion ultima linea
4. **Seguridad express:** ¿toca datos sensibles, credenciales, queries, logs?
5. **Declarar resultado:** "Verificacion post-mod: [archivos] — sin inconsistencias"

### Definicion de terminado

Antes de declarar cualquier entregable como terminado:

1. **Alcance asumido:** Declarar en una frase
2. **Contexto padre:** Verificar contra este design doc
3. **Segundo uso:** ¿Funciona con otro tenant/datos distintos?
4. **Viabilidad externa:** ¿Depende de algo fuera del codigo?

### Regla de las dos opciones

Antes de implementar cualquier solucion: listar 2 opciones con pros/contras.
Ambas deben cumplir piso minimo de seguridad. Pato elige.

### Declaracion de incertidumbre

- VERIFICADO: documentacion oficial → presentar normal
- ALTA CONFIANZA: patron conocido → presentar normal
- INCERTIDUMBRE: no seguro → decirlo ANTES de proceder
- NO SE: sin info → decirlo, NUNCA inventar

### Context7 MCP — uso proactivo

Antes de escribir codigo que use librerias (Grafana API, Recharts types,
Next.js loading, etc.), consultar Context7 para sintaxis actual.

### Modo educativo

En CADA interaccion: explicar QUE, POR QUE, y QUE CONCEPTO involucra.

### Anti-degradacion

Si se detectan 2+ indicadores de degradacion (cambios sin explicar,
saltear checklists, respuestas cortas, parchear sin entender) → PARAR
y recomendar commit + sesion nueva.

---

## Bloque 0: Orquestador — COMPLETADO

**Estado:** Descomentado en crontab el 2026-03-03.
**Verificacion:** `crontab -l` confirma 5/5 jobs activos.
**Proximo run:** 2026-03-04 05:00 AM.

---

## Bloque 1: Grafana conectado a PostgreSQL

### 1.1 Usuario grafana_reader (migracion SQL)

```sql
-- Migration 032: Grafana monitoring setup
CREATE ROLE grafana_reader WITH LOGIN PASSWORD '***' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Solo SELECT en tablas de monitoreo (sin RLS, sin datos de clientes)
GRANT CONNECT ON DATABASE orion_db TO grafana_reader;
GRANT USAGE ON SCHEMA public TO grafana_reader;
```

### 1.2 VIEWs de monitoreo (solo metricas agregadas)

**Principio:** grafana_reader NUNCA ve datos individuales de clientes.
Solo conteos, sumas, y estados.

```sql
-- VIEW 1: Metricas de operaciones
CREATE VIEW monitoring_operations AS
SELECT
    started_at::date AS run_date,
    status,
    tenants_processed,
    predictions_generated,
    jsonb_array_length(errors) AS error_count,
    EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM orchestrator_runs;

-- VIEW 2: Metricas de costos
CREATE VIEW monitoring_costs AS
SELECT
    usage_date,
    COUNT(*) AS api_calls,
    SUM(tokens_input) AS tokens_in,
    SUM(tokens_output) AS tokens_out,
    SUM(tokens_total) AS tokens_total,
    SUM(cost_usd) AS cost_usd
FROM api_usage
GROUP BY usage_date;

-- VIEW 3: Metricas de sync
CREATE VIEW monitoring_syncs AS
SELECT
    started_at::date AS sync_date,
    sync_type,
    source,
    status,
    customers_synced,
    products_synced,
    orders_synced,
    EXTRACT(EPOCH FROM (completed_at - started_at)) AS duration_seconds
FROM sync_log;

-- VIEW 4: Metricas de predicciones (conteos, sin datos de clientes)
CREATE VIEW monitoring_predictions AS
SELECT
    prediction_date,
    vertical,
    status,
    COUNT(*) AS count,
    AVG(confidence_score)::numeric(3,2) AS avg_confidence
FROM predictions
GROUP BY prediction_date, vertical, status;

-- GRANT solo las VIEWs
GRANT SELECT ON monitoring_operations, monitoring_costs,
    monitoring_syncs, monitoring_predictions TO grafana_reader;
```

**Seguridad:** Estas VIEWs no exponen tenant_id, customer_id,
message_text, ni metadata. Solo metricas agregadas.

### 1.3 Datasource Grafana

Configurar via UI de Grafana (`devgrafana.menteax.com`):
- Type: PostgreSQL
- Host: `172.18.0.10:5432` (IP interna Docker)
- Database: `orion_db`
- User: `grafana_reader`
- SSL: disable (red interna Docker)

Alternativa: provisioning via YAML en `/opt/orion-stack/configs/grafana/`
(requiere sudo para montar volumen).

---

## Bloque 2: Dashboard "Operaciones"

6 paneles en un dashboard llamado "PymePilot — Operaciones":

| # | Panel | Tipo | Fuente |
|---|-------|------|--------|
| 1 | Estado hoy | Stat (semaforo) | `monitoring_operations` |
| 2 | Predicciones generadas hoy | Stat (numero) | `monitoring_predictions` |
| 3 | Predicciones por vertical (7 dias) | Bar chart | `monitoring_predictions` |
| 4 | Syncs ERP (7 dias) | Tabla | `monitoring_syncs` |
| 5 | Historial orquestador (30 dias) | Time series | `monitoring_operations` |
| 6 | Errores recientes | Tabla | `monitoring_operations` WHERE error_count > 0 |

Configuracion: auto-refresh cada 30 minutos, timezone America/Argentina/Buenos_Aires.

---

## Bloque 3: Dashboard "Costos Claude"

6 paneles + 2 alertas en "PymePilot — Costos":

| # | Panel | Tipo | Fuente |
|---|-------|------|--------|
| 1 | Gasto hoy (USD) | Stat | `monitoring_costs` |
| 2 | Tokens hoy vs limite | Gauge 0-100% | `monitoring_costs` vs 100k |
| 3 | Gasto mensual acumulado | Stat | `monitoring_costs` |
| 4 | Tokens por dia (30 dias) | Time series | `monitoring_costs` |
| 5 | Costo USD por dia (30 dias) | Time series | `monitoring_costs` |
| 6 | Llamadas por dia (30 dias) | Bar chart | `monitoring_costs` |

### Alertas

| Alerta | Condicion | Accion |
|--------|-----------|--------|
| Warning 70% | `tokens_total_hoy >= 70000` | Panel amarillo + log Grafana |
| Critical 90% | `tokens_total_hoy >= 90000` | Panel rojo + log Grafana |

Las alertas se configuran en Grafana (no requieren servidor SMTP).
Se evaluan cada 5 minutos. Visibles como anotaciones en el dashboard.

---

## Bloque 4: Deuda tecnica — Seguridad (migracion 033)

### 4.1 CORS en Kong

**Archivo:** `/opt/orion-stack/kong.yml` (requiere sudo)
**Cambio:** `Access-Control-Allow-Origin: *` → `Access-Control-Allow-Origin: https://app.pymepilot.cloud`
**Ejecucion:** Pato ejecuta manualmente (se le da el comando exacto + docker restart).

### 4.2 EXCEPTION WHEN OTHERS → excepciones especificas

```sql
-- ANTES (catch-all peligroso):
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;

-- DESPUES (explicito):
EXCEPTION
    WHEN undefined_table THEN
        RAISE WARNING 'MV no existe: %', SQLERRM;
    WHEN lock_not_available THEN
        RAISE WARNING 'MV bloqueada, reintento pendiente: %', SQLERRM;
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error inesperado refrescando MVs: %', SQLERRM;
```

Errores conocidos se manejan con WARNING. Errores desconocidos se
re-lanzan con EXCEPTION (no se tragan).

### 4.3 Cast inseguro → validacion

```sql
-- ANTES:
SUM((p.metadata->>'attribution_amount')::numeric)

-- DESPUES:
SUM(
    CASE
        WHEN p.metadata->>'attribution_amount' ~ '^\d+\.?\d*$'
        THEN (p.metadata->>'attribution_amount')::numeric
        ELSE 0
    END
)
```

### 4.4 DoS parametros → limite superior

```sql
-- En CADA RPC que recibe p_months:
-- ANTES:
WHERE p.prediction_date >= (now() - (p_months || ' months')::interval)

-- DESPUES:
WHERE p.prediction_date >= (now() - (LEAST(p_months, 24) || ' months')::interval)
```

Aplica a: `get_monthly_value`, `get_revenue_split`, `get_monthly_churn`,
`get_avg_ticket`, `get_client_trends`, `get_client_monthly_revenue`.

---

## Bloque 5: Deuda tecnica — Calidad

### 5.1 formatCurrency → lib/format.ts

Crear `frontend/src/lib/format.ts` con:
```typescript
export function formatCurrency(n: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(n);
}
```
Reemplazar las 5 copias por `import { formatCurrency } from '@/lib/format'`.

### 5.2 any types → tipos correctos de Recharts

```typescript
// ANTES:
/* eslint-disable @typescript-eslint/no-explicit-any */
const CustomTooltip = ({ active, payload, label }: any) => {

// DESPUES:
import type { TooltipProps } from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
```

Aplica a: revenue-chart, value-chart, ticket-chart, churn-chart.

### 5.3 loading.tsx para /metricas

Crear `frontend/src/app/(dashboard)/metricas/loading.tsx` con skeleton
apropiado (4 cards + area de graficos).

### 5.4 Normalizacion duplicada en contactar

Revisar `contactar-content.tsx` y eliminar la doble llamada a
`normalize_customer_name()`.

### 5.5 UNION ALL en cross_sell_candidates

Revisar la query en `cross_sell.py`. Si el impacto en precision
es real → ajustar. Si es teorico → documentar con comentario
explicando la decision y cerrar.

---

## Bloque 6: Documentacion

| Documento | Accion | Contenido clave |
|-----------|--------|-----------------|
| `docs/ROADMAP.md` | Actualizar | Fases 0-9 con fechas reales, duracion real (13 dias), seccion post-MVP |
| `docs/ARCHITECTURE.md` | Crear | Stack, flujo de datos, multi-tenant, cron jobs, monitoreo, diagrama |
| `docs/PRD.md` | Actualizar | Resultados IEY reales, verticales operativas, estado actual |

---

## Bloque 7: Auditoria final

Auditoria de seguridad completa sobre todo lo nuevo:
- Migration 032 (Grafana setup) + 033 (fixes seguridad)
- Dashboards Grafana (no expongan datos sensibles)
- Cambios frontend (types, imports)
- CORS fix en Kong
- Documentacion actualizada

Criterio: 0 CRITICAL, 0 HIGH.

---

## Orden de ejecucion

```
Sesion 1: Bloque 1 (Grafana + PG) + Bloque 2 (Dashboard Operaciones)
Sesion 2: Bloque 3 (Dashboard Costos + alertas)
Sesion 3: Bloque 4 (MEDIUMs seguridad) + Bloque 5 (MEDIUMs calidad)
Sesion 4: Bloque 6 (Documentacion)
Sesion 5: Bloque 7 (Auditoria final)
```

## Fuera de alcance

- Instrumentacion Python con `prometheus_client`
- Notificacion WhatsApp diaria (bloqueada por SIM chip)
- Nuevas verticales o funcionalidad de negocio
- Limpieza config Prometheus (targets N8N/Qdrant — cosmetico)
- Servidor SMTP para alertas por email (alertas visuales en dashboard son suficientes)

---

## Datos reales del sistema (para referencia)

### api_usage (orion_db)
| Fecha | Llamadas | Tokens | Costo USD |
|-------|----------|--------|-----------|
| 2026-02-27 | 2 | 2,319 | $0.011 |
| 2026-02-26 | 57 | 63,447 | $0.287 |
| 2026-02-24 | 4 | 9,400 | $0.036 |
| 2026-02-22 | 5 | 2,969 | $0.015 |

### orchestrator_runs (orion_db)
| Fecha | Status | Tenants | Predicciones |
|-------|--------|---------|-------------|
| 2026-02-26 | completed | 1 | 20 |
| 2026-02-26 | completed | 1 | 0 |

### predictions (orion_db)
| Fecha | Vertical | Status | Cantidad |
|-------|----------|--------|----------|
| 2026-02-27 | cross_sell | pending | 2 |
| 2026-02-26 | recuperacion | pending | 2 |
| 2026-02-26 | reposicion | pending | 20 |

### Base de datos
- DB: `orion_db` (NO `postgres`)
- Host: `172.18.0.10:5432`
- Tablas con RLS: predictions, sync_log, customers, products, orders, order_items
- Tablas sin RLS: api_usage (global), orchestrator_runs (global)
