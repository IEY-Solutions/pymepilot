# Handoff — Fase 3 Dashboard MVP (Implementación)
**Fecha:** 2026-02-23
**Estado:** Código completo, pendiente: verificar GoTrue login + deploy

---

## Qué se hizo en esta sesión

### 3A-1: Migración 016 — Consolidar tablas en orion_db
- **Archivo:** `database/migrations/016_consolidate_to_orion_db.sql` + rollback
- Ejecutada contra orion_db: 9 tablas, índices, funciones, triggers, RLS + FORCE RLS
- Datos copiados con pg_dump --data-only (tabla por tabla, en orden FK)
- **Verificado:** conteos idénticos (tenants=1, customers=40, products=20, orders=30, order_items=67, predictions=1, sync_log=11, api_usage=5)

### 3A-2: Migración 017 — RLS dual-mode + permisos
- **Archivo:** `database/migrations/017_rls_dual_mode_and_permissions.sql` + rollback
- Función `get_current_tenant_id()`: lee JWT (dashboard) O app.tenant_id (Python). Fail-closed.
- GRANTs tabla por tabla para `authenticated` (SELECT + UPDATE predictions) y `pymepilot_app`
- **5/5 tests de seguridad pasados:**
  1. authenticated + JWT IEY = 40 customers ✅
  2. JWT sin tenant_id = 0 rows ✅
  3. anon = permission denied ✅
  4. pymepilot_app + set_tenant_context = 40 customers ✅
  5. tenant inexistente = 0 rows ✅
- `.env` cambiado: `DATABASE_NAME=orion_db`
- Motor Python verificado con `run_vertical.py --dry-run` OK

### 3B: Next.js + Auth + Layout
- Proyecto Next.js 16.1.6 creado en `frontend/`
- Dependencias: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`
- `frontend/.env.local` configurado con ANON_KEY real
- Supabase SSR helpers: `src/lib/supabase/{client,server,middleware}.ts`
- Middleware protege rutas (redirige a /login si no autenticado)
- Login page: email + password
- Layout mobile-first: sidebar (desktop >=768px) + bottom-nav (mobile)
- 4 items de navegación: Inicio, Contactar, Historial, Datos

### 3C: Páginas del dashboard
- **Inicio** (`/`): 4 KPI cards (pendientes, tasa contacto, clientes activos, última sync)
- **Contactar Hoy** (`/contactar`): prediction cards con copiar mensaje, marcar contactado/ignorar
- **Historial** (`/historial`): lista con filtros (estado, búsqueda) y paginación
- **Datos** (`/datos`): conteo de registros, últimas 5 syncs, alerta si >48h
- **Build exitoso** (`npm run build` pasa sin errores)

### Usuario GoTrue de test
- Email: `vendedor@iey.test`
- Password: `TestPassword123`
- UUID: `48be0415-f94a-4d6a-b94b-b79f9a377064`
- Insertado directamente en `auth.users` + `auth.identities` + `user_profiles`
- app_metadata: `{"tenant_id": "b815e5d6-2ef0-4d27-999b-8a7642b71183", "role": "vendedor"}`

---

## Estado de GoTrue (el tema pendiente principal)

### Problema
GoTrue busca tabla `users` sin prefijo `auth.` porque su connection URL no tiene `?search_path=auth`. La URL en docker-compose.yml SÍ lo tiene, pero se pierde al resolver variables (posible caracter especial en POSTGRES_PASSWORD que trunca el query string).

### Lo que se intentó
1. **Generar SERVICE_ROLE_KEY manualmente** → Kong la rechazó (no es la original)
2. **ALTER DATABASE orion_db SET search_path = auth, public** → GoTrue intentó re-correr migraciones y una falló (`uuid = text` comparison bug)
3. **Revertir + marcar migraciones como ejecutadas + ALTER DATABASE de nuevo** → GoTrue arrancó OK ("Up 22 seconds")

### Estado actual
- `ALTER DATABASE orion_db SET search_path TO auth, public;` está aplicado
- Las 43 migraciones de GoTrue están marcadas como ejecutadas en `auth.schema_migrations`
- GoTrue arrancó sin crash loop
- **NO SE VERIFICÓ si el login funciona ahora** (Pato cortó la sesión acá)

### Próximo paso inmediato
Verificar si GoTrue login funciona:
```bash
bash /tmp/test_gotrue.sh
```
Si ese archivo no existe, el comando es:
```bash
curl -s -X POST "http://IP_AUTH:9999/token?grant_type=password" -H "Content-Type: application/json" -d '{"email":"vendedor@iey.test","password":"TestPassword123"}'
```
Donde IP_AUTH se obtiene con:
```bash
docker inspect orion-menteax_auth --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

**Si devuelve `access_token`** → GoTrue funciona, seguir con deploy.
**Si devuelve error 500** → Revisar logs (`docker logs orion-menteax_auth --tail 10`).

---

## Pendientes para Fase 3 end-to-end

### 1. Verificar GoTrue login (descrito arriba)

### 2. Deploy con pm2 + Traefik
```bash
# Instalar pm2
sudo npm install -g pm2

# Build y arrancar
cd /home/pato/projects/pymepilot/frontend
npm run build
pm2 start npm --name "pymepilot-dashboard" -- start -- -p 3000
pm2 save && pm2 startup
```

Para Traefik (rutear app.pymepilot.cloud → puerto 3000):
- Crear registro DNS A: `app.pymepilot.cloud → 173.249.9.56`
- Crear config dinámica de Traefik apuntando a `http://172.18.0.1:3000`

### 3. Test end-to-end
1. Login como vendedor@iey.test en el browser
2. Ver "Contactar Hoy" con predicción existente
3. Copiar mensaje (desktop + mobile)
4. Marcar como contactado → verificar cambio en DB
5. KPIs correctos en inicio
6. Estado de datos muestra syncs
7. Historial permite filtrar
8. Motor Python dry-run sigue OK

---

## Riesgo: search_path afecta PostgREST

`ALTER DATABASE orion_db SET search_path TO auth, public` cambia el search_path para TODAS las conexiones a orion_db, incluyendo PostgREST. Esto podría causar conflictos si PostgREST busca tablas por nombre sin schema y encuentra las de `auth` antes que las de `public`. Para el MVP esto no debería ser problema (nuestras tablas tienen nombres distintos a las de auth), pero hay que verificar que las queries de Supabase client funcionen correctamente post-login.

Si hay conflictos, la alternativa es:
```sql
ALTER DATABASE orion_db RESET search_path;
ALTER ROLE postgres IN DATABASE orion_db SET search_path TO auth, public;
```
Esto solo afectaría al usuario `postgres` (que es el que usa GoTrue), no a `authenticated` ni `anon` (que usa PostgREST).

---

## Archivos creados/modificados en esta sesión

### Nuevos
- `database/migrations/016_consolidate_to_orion_db.sql`
- `database/migrations/016_rollback.sql`
- `database/migrations/017_rls_dual_mode_and_permissions.sql`
- `database/migrations/017_rollback.sql`
- `frontend/` — proyecto Next.js completo
- `frontend/src/lib/supabase/{client,server,middleware}.ts`
- `frontend/src/middleware.ts`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/app/(dashboard)/page.tsx` (KPIs)
- `frontend/src/app/(dashboard)/contactar/page.tsx`
- `frontend/src/app/(dashboard)/historial/page.tsx`
- `frontend/src/app/(dashboard)/datos/page.tsx`
- `frontend/src/components/layout/{header,sidebar,bottom-nav}.tsx`
- `frontend/src/components/predictions/{prediction-card,prediction-actions,copy-button}.tsx`

### Modificados
- `frontend/src/app/layout.tsx` — título y lang="es"
- `frontend/src/app/globals.css` — limpiado
- `frontend/.env.local` — ANON_KEY real
- `.env` — `DATABASE_NAME=orion_db`

### No commiteados
Nada fue commiteado. Todo está en working directory.

---

## Prompt para iniciar próxima sesión

```
Continuamos con la Fase 3 del dashboard MVP de PymePilot.
Lee el handoff en docs/handoffs/2026-02-23_fase3_implementation_session.md

Pendientes en orden:
1. Verificar que GoTrue login funciona (se hizo ALTER DATABASE search_path + marcaron migraciones)
2. Si no funciona, aplicar el fix alternativo (ALTER ROLE postgres IN DATABASE)
3. Deploy: pm2 + Traefik para app.pymepilot.cloud
4. Test end-to-end completo
5. Commit de todo

El código del dashboard está completo y compila. Solo falta que GoTrue acepte logins
y deployar.
```
