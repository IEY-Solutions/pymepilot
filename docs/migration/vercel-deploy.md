# Deploy del dashboard en Vercel

Estado: runbook activo para desplegar el dashboard Next.js de PymePilot.
Ultima verificacion local: 2026-05-24.

## Alcance

Este deploy cubre solo `frontend/`, que es el dashboard Next.js.

No mueve a Vercel:

- motor Python de `backend/`
- PostgreSQL, RLS, GoTrue, PostgREST ni Storage
- crons de sync, atribucion, verticales o uploads
- Grafana/Prometheus

Esos servicios deben existir como backend externo. El frontend en Vercel habla con Supabase/PostgREST mediante `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y usa route handlers de Next para funciones como chat, pipeline, key accounts y push.

## Configuracion en Vercel

Al importar el repo:

1. Framework Preset: `Next.js`
2. Root Directory: `frontend`
3. Install Command: `npm ci`
4. Build Command: `npm run build`
5. Output Directory: dejar automatico

No importar el repo con root `.` como app principal. La raiz contiene backend, database, docs y tooling operativo; la app deployable esta en `frontend/`.

## Variables requeridas

Configurar en Vercel, no commitear en Git:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

Variables opcionales segun modulo activo:

```text
CHAT_MODEL=claude-sonnet-4-20250514
CHAT_DAILY_LIMIT=20
CHAT_MAX_TOKENS=1000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL=
```

## Checklist pre-deploy

Desde `frontend/`:

```bash
npm ci
npm run lint
npm run build
```

Resultado esperado:

- ESLint sin errores ni warnings.
- `next build` completo.
- La salida debe listar rutas dinamicas y `Proxy`.

## Dependencias y audit

Antes de deploy revisar:

```bash
npm audit --omit=dev
```

Estado al 2026-05-24:

- Se actualizo Next/React a `16.2.6` / `19.2.6`.
- Se elimino `xlsx` por vulnerabilidad high sin fix disponible.
- El export Excel de metricas usa `exceljs`.
- Quedan 2 vulnerabilidades moderate transitivas reportadas por `npm audit` en `next -> postcss`. `npm audit fix --force` propone un downgrade incompatible a Next 9, por lo que no debe ejecutarse sin una decision tecnica explicita.

## Checklist post-deploy

1. Abrir `/login`.
2. Iniciar sesion con usuario de tenant de prueba.
3. Verificar que el dashboard no muestra datos de otro tenant.
4. Abrir `/metricas`, `/pipeline`, `/datos`, `/asesor` y `/cuentas-clave`.
5. Probar una accion no destructiva: refrescar pipeline o abrir detalle.
6. Revisar logs de Vercel Functions para errores de Supabase o Anthropic.

## Guardrail multi-tenant

El frontend no decide aislamiento. La seguridad depende de:

- JWT con `tenant_id`.
- RLS en PostgreSQL.
- RPCs y vistas seguras.
- Supabase anon key, nunca service role en el browser.

No agregar service-role keys ni credenciales ERP a Vercel frontend.

## Fuentes oficiales verificadas

- Next.js Proxy: https://nextjs.org/docs/app/getting-started/proxy
- Next.js proxy file convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Vercel monorepos/root directory: https://vercel.com/docs/monorepos
- Vercel environment variables: https://vercel.com/docs/environment-variables
