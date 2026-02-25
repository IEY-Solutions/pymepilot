# Fase 4: Orquestador Diario — Documento de Diseño

**Fecha:** 2026-02-26
**Estado:** Aprobado
**Decisiones tomadas en brainstorming con Pato**

---

## Objetivo

Que el sistema funcione automáticamente todos los días sin intervención manual.
El vendedor abre el dashboard a las 8 AM y las predicciones del día ya están listas.

## Decisiones de diseño

### 1. Script único (no cron escalonado)

Un solo archivo `backend/main.py` ejecuta toda la pipeline en secuencia.
Un solo cron entry (`0 5 * * *`). Si un paso depende del anterior,
la secuencia garantiza el orden. Más simple de debuggear y monitorear.

### 2. Un canal de ingesta por tenant

Cada tenant tiene UN solo canal activo (API, Drive, o Excel manual).
Nunca estarán los 3 activos simultáneamente para el mismo tenant.
El orquestador solo ejecuta sync para tenants con canal API.
Drive y Excel ya tienen su propia automatización independiente.

### 3. Verticales configurables en DB

Columna `active_verticals JSONB` en tabla `tenants`.
Default: `["reposicion"]`. El orquestador lee esta config y ejecuta
solo las verticales listadas. Evita tocar código al activar una nueva.

### 4. Límite de tokens para todo

Si `DailyLimitExceeded` salta en cualquier tenant, el orquestador
para las verticales de TODOS los tenants restantes. Sync y atribución
de tenants pendientes sí se ejecutan (no usan Claude API).

### 5. Dashboard: reutilizar + indicador mínimo

Reutilizar frescura existente (sync_log → tarjeta verde/amarillo/rojo).
Agregar tarjeta de "Predicciones de hoy" con cantidad y hora de última corrida.

---

## Arquitectura

### Flujo diario completo (crontab)

```
3:00 AM  — Backup PostgreSQL (existente, no se toca)
4:30 AM  — Drive sync (existente, solo tenants con canal Drive)
cada 1m  — Upload worker (existente, procesa cola de uploads)
5:00 AM  — ★ ORQUESTADOR (main.py) ★
5:30 AM  — Freshness check (existente)
```

### Pipeline del orquestador (5:00 AM)

```
main.py arranca
│
├─ Leer tenants activos de la DB
│
├─ Por cada tenant:
│   ├─ ¿Canal API? → Sync ERP
│   ├─ Si sync falló → SKIP atribución y verticales, pasar al siguiente
│   ├─ Atribución (cruzar predicciones anteriores vs compras nuevas)
│   ├─ Por cada vertical en active_verticals:
│   │   └─ Generar predicciones
│   └─ Si DailyLimitExceeded → parar verticales globalmente
│
├─ Registrar resultado en orchestrator_runs
└─ Cerrar pool de conexiones
```

### Lo que NO hace el orquestador

- No toca Drive sync ni upload worker (ya tienen su cron)
- No toca backup ni freshness check (ya automatizados)
- No ejecuta sync para tenants con canal Excel/Drive (ya cubiertos)

---

## Modelo de datos

### Tabla nueva: `orchestrator_runs`

```sql
CREATE TABLE public.orchestrator_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'partial', 'failed', 'limit_exceeded')),
    tenants_processed INTEGER DEFAULT 0,
    predictions_generated INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

Sin tenant_id (global, como api_usage). Sin RLS.
Solo el backend escribe (pymepilot_app INSERT+SELECT).
Dashboard lee via PostgREST (authenticated SELECT).

### Cambio en tabla `tenants`

```sql
ALTER TABLE public.tenants
ADD COLUMN active_verticals JSONB DEFAULT '["reposicion"]'::jsonb;
```

---

## Estados del orquestador

| Estado | Significado |
|---|---|
| `running` | Ejecución en curso |
| `completed` | Todos los tenants procesados sin error |
| `partial` | Algunos tenants OK, otros fallaron |
| `failed` | Todos los tenants fallaron |
| `limit_exceeded` | Se alcanzó el límite diario de tokens |

---

## Manejo de errores

1. **Sync falla** → Log error, skip atribución y verticales para ese tenant, continuar con el siguiente
2. **Atribución falla** → Log error, continuar con verticales (son independientes)
3. **Vertical falla** → Log error, continuar con siguiente vertical/tenant
4. **DailyLimitExceeded** → Parar verticales de todos los tenants, completar syncs y atribuciones pendientes
5. **Error catastrófico** (DB caída, pool roto) → Log, marcar run como `failed`, salir limpio

---

## Indicador en dashboard

### Reutilizado (sin cambios)

- Tarjeta de frescura: verde/amarillo/rojo basada en sync_log
- Badge de notificaciones: alerta si datos > 72 horas
- Página Contactar: lista predicciones pendientes

### Nuevo: tarjeta "Predicciones de hoy"

En la página de KPIs (home):

```
┌─────────────────────────────┐
│  Predicciones de hoy        │
│  12 contactos sugeridos     │
│  Última corrida: 5:47 AM    │
└─────────────────────────────┘
```

Queries:
- Cantidad: `SELECT COUNT(*) FROM predictions WHERE prediction_date = CURRENT_DATE AND status = 'pending'`
- Hora: `SELECT completed_at FROM orchestrator_runs ORDER BY started_at DESC LIMIT 1`

---

## Contexto existente reutilizado

| Componente | Estado | Rol en Fase 4 |
|---|---|---|
| `sync_erp.py` / `SyncEngine` | Funciona | Orquestador lo invoca internamente |
| `run_vertical.py` / `VerticalBase` | Funciona | Orquestador lo invoca internamente |
| `run_attribution.py` | Funciona | Orquestador lo invoca internamente |
| `check_data_freshness.py` | Cron 5:30 AM | Se mantiene independiente |
| `sync_google_drive.py` | Cron 4:30 AM | Se mantiene independiente |
| `process_uploads.py` | Cron cada 1 min | Se mantiene independiente |
| Freshness card + notifications | Dashboard | Se reutiliza sin cambios |
