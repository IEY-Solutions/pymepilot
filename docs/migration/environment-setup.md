# Entorno para deploy Vercel + backend externo

Este archivo separa variables por runtime para evitar mezclar secretos de backend con el dashboard.

## Vercel frontend

Variables publicas seguras para el browser:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_DRIVE_SERVICE_ACCOUNT_EMAIL=
```

Variables server-side usadas por route handlers de Next:

```text
ANTHROPIC_API_KEY=
CHAT_MODEL=claude-sonnet-4-20250514
CHAT_DAILY_LIMIT=20
CHAT_MAX_TOKENS=1000
```

No configurar en Vercel frontend:

```text
DATABASE_PASSWORD
ERP_ENCRYPTION_KEY
CONTABILIUM_CLIENT_SECRET
SUPABASE_SERVICE_ROLE_KEY
```

## Backend Python / servidor operativo

El backend Python necesita su propio entorno en el host donde corren crons y scripts:

```text
DATABASE_HOST=
DATABASE_PORT=
DATABASE_NAME=
DATABASE_USER=
DATABASE_PASSWORD=
ANTHROPIC_API_KEY=
CONTABILIUM_API_URL=
ERP_ENCRYPTION_KEY=
ENVIRONMENT=
LOG_LEVEL=
```

Las credenciales ERP son por tenant y deben seguir encriptadas en DB. No deben migrarse a variables globales de Vercel.

## Supabase / Postgres

Antes de apuntar Vercel a un backend:

1. Confirmar que la URL publica de Supabase/PostgREST es accesible desde internet.
2. Confirmar CORS para el dominio final de Vercel.
3. Confirmar que la anon key corresponde al mismo stack.
4. Confirmar migraciones aplicadas, especialmente las de RLS y RPCs usadas por el frontend.

## Validacion minima

Despues de configurar variables:

```bash
cd frontend
npm ci
npm run lint
npm run build
```

Luego probar login y lectura por tenant desde el deploy.
