# Runbook general de migracion a Vercel

## Fase 1 - Preparar frontend

Estado actual: completado el 2026-05-24.

- Next actualizado a `16.2.6`.
- `middleware.ts` migrado a `proxy.ts`.
- `npm run lint` pasa sin warnings.
- `npm run build` pasa.
- `xlsx` removido; export Excel migrado a `exceljs`.
- assets default de Next eliminados.

## Fase 2 - Preparar backend externo

Antes de apuntar Vercel al backend:

1. Confirmar URL publica de Supabase/PostgREST.
2. Confirmar CORS para dominio de Vercel.
3. Confirmar migraciones aplicadas.
4. Confirmar usuario de prueba con `tenant_id`.
5. Confirmar que el backend Python puede correr sync y verticales contra esa DB.

## Fase 3 - Crear proyecto Vercel

1. Importar repositorio.
2. Seleccionar Root Directory `frontend`.
3. Configurar variables de entorno.
4. Deploy preview.
5. Probar login, metricas, pipeline, datos y asesor.

## Fase 4 - Validacion multi-tenant

Validar que tenant A no puede leer datos de tenant B:

- usuario con `tenant_id` correcto en GoTrue
- RLS activo en tablas sensibles
- RPCs de metricas filtradas por tenant
- sin service role en frontend

## Fase 5 - Cutover

1. Elegir dominio final.
2. Configurar DNS hacia Vercel.
3. Ajustar CORS en backend al dominio final.
4. Revisar logs de Vercel Functions durante el primer uso real.
5. Mantener el host backend operativo para crons y DB.

## Criterio de exito

El dashboard Vercel funciona para un tenant real sin errores de build, sin warnings de lint, sin exponer secretos y con datos aislados por RLS.
