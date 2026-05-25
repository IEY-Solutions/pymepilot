# Operacion manual durante migracion

Este documento aplica si el dashboard se mueve a Vercel antes de automatizar nuevamente todos los procesos batch.

## Objetivo

Mantener el producto funcionando aunque el orquestador automatico no corra en Vercel.

## Tareas que siguen fuera de Vercel

- sync ERP
- procesamiento de uploads
- Google Drive sync
- refresh de vistas materializadas
- atribucion
- generacion de predicciones por modulo
- freshness check
- backups

## Secuencia manual recomendada

Ejecutar desde el host donde vive el backend Python y la DB, no desde Vercel:

```bash
cd ~/projects/pymepilot

backend/venv/bin/python backend/scripts/sync_erp.py --tenant-slug TENANT
backend/venv/bin/python backend/scripts/run_attribution.py --tenant-slug TENANT
backend/venv/bin/python backend/scripts/run_vertical.py --tenant-slug TENANT --vertical reposicion
backend/venv/bin/python backend/scripts/run_vertical.py --tenant-slug TENANT --vertical activacion
backend/venv/bin/python backend/scripts/run_vertical.py --tenant-slug TENANT --vertical recuperacion
```

`cross_sell` debe ejecutarse solo si corresponde por calendario operativo.

## Validacion

1. Revisar logs del backend.
2. Confirmar que `sync_log` tiene ejecucion reciente.
3. Confirmar que `/pipeline` y `/metricas` en Vercel reflejan datos nuevos.
4. Confirmar que no hubo errores de RLS o tenant context.

## Regla de seguridad

Las tareas manuales no deben usar service-role desde el browser ni exponer credenciales en logs. Todo acceso ERP sigue siendo read-only.
