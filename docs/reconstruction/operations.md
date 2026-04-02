# Operacion

## Alta de un tenant

El onboarding real ya esta modelado en `backend/scripts/create_tenant.py`.
La secuencia que hay que preservar es:

1. Crear el tenant.
2. Crear el admin.
3. Guardar credenciales ERP si aplican.
4. Verificar RLS y perfiles.

Si este flujo cambia, cambia la forma en que el sistema se puede operar.

## Sync y ejecuciones

- `backend/main.py` corre la pipeline diaria completa.
- `backend/scripts/sync_erp.py` sirve para ejecucion manual y debug.
- `backend/scripts/run_vertical.py` permite correr una vertical puntual.
- `backend/scripts/run_attribution.py` mide valor recuperado.
- `backend/scripts/process_uploads.py` queda como worker separado.

## Crons y schedule

- Backup PostgreSQL: activo.
- Freshness check: activo.
- Upload worker: desactivado.
- Google Drive sync: desactivado.
- Orquestador con flock: desactivado hasta reactivacion de la pieza correcta.

## Monitoreo

- Grafana y Prometheus forman parte del sistema operativo.
- Los probes criticos deben incluir Postgres, API/Auth y app.
- El dashboard versionado es parte del contexto, no un extra cosmetico.

## Politica operativa

- Cargar `.env` con ruta explicita.
- Validar entorno antes de correr entrypoints.
- Sanitizar logs y no imprimir secretos.
- Usar `dry-run` cuando el objetivo sea validar flujo sin costo.

## Incidentes que hay que recordar

- El orden de imports en entrypoints importa.
- El contexto de tenant no es opcional.
- El gateway de auth puede requerir fallback directo al contenedor.
- Los errores de model routing o token budget deben quedar visibles en logs.
