# Arquitectura objetivo: Vercel + Supabase/Postgres externo

## Resumen

La arquitectura recomendada no intenta meter todo PymePilot en Vercel.

Vercel aloja:

- dashboard Next.js
- route handlers de UI (`/api/chat`, `/api/pipeline`, `/api/key-accounts`, `/api/push`)
- proxy de auth/session refresh

El backend externo aloja:

- PostgreSQL con RLS
- GoTrue/Auth
- PostgREST
- Storage
- motor Python de seguimiento
- conectores ERP read-only
- crons operativos
- Grafana/Prometheus si se mantiene monitoreo actual

## Flujo

```text
Usuario
  -> Vercel Next.js dashboard
  -> Supabase/PostgREST externo
  -> PostgreSQL RLS por tenant_id

Crons externos
  -> backend Python
  -> ERP read-only
  -> PostgreSQL
  -> predictions / pipeline / metrics
```

## Por que no todo en Vercel

El producto tiene procesos largos y operativos:

- sync ERP
- parsing de archivos
- orquestador diario
- atribucion
- generacion de verticales
- monitoreo

Eso no es buen fit para Functions de Vercel como runtime principal. Vercel debe ser la capa web. El motor y la base de datos deben quedar como servicios persistentes.

## Contratos que no se pueden romper

- `tenant_id + RLS` es el aislamiento primario.
- ERP connectors son solo lectura.
- El browser usa anon key, nunca service role.
- Anthropic API se usa server-side.
- El backend Python sigue controlando costos y orquestacion productiva.

## Segundo tenant

La arquitectura es tenant-agnostica. No hay reglas IEY hardcodeadas en Vercel. Cualquier variacion de cliente debe vivir en:

- configuracion por tenant
- tablas de mapping
- prompts parametrizados
- adapters de connector
- feature flags o `active_modules`

## Riesgos principales

1. CORS mal configurado entre Vercel y Supabase.
2. Migraciones no aplicadas en la DB destino.
3. Usuario GoTrue sin `tenant_id` en metadata.
4. Service role expuesta por error en Vercel.
5. Backend Python apagado: dashboard funciona, pero datos/predicciones quedan viejos.

## Verificacion de seguridad

Para considerar listo el deploy:

- login funciona con un usuario real
- RLS impide ver datos de otro tenant
- `/metricas` y `/pipeline` cargan sin usar service role
- `/asesor` responde sin exponer `ANTHROPIC_API_KEY`
- logs no imprimen tokens, passwords ni credenciales ERP
