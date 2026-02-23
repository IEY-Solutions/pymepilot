# Handoff — Fase 3 Dashboard MVP (Implementación + Deploy)
**Fecha:** 2026-02-23
**Estado:** COMPLETADA — Dashboard live en https://app.pymepilot.cloud
**Commits:** `87aa20e` (código), `5a5f52c` (deploy Docker+Traefik)

---

## Qué se hizo en esta fase (2 sesiones)

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
- `frontend/.env.local` + `frontend/.env` configurados con ANON_KEY real
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

### 3D: Deploy Docker + Traefik (sesión 2)
- **Dockerfile:** multi-stage (deps → builder → runner) con `output: "standalone"`
- **docker-compose.yml:** red `orion-stack_traefik-public`, labels Traefik para HTTPS
- **Build args:** NEXT_PUBLIC_ vars se pasan como ARG→ENV solo en builder stage
- **URL:** `https://app.pymepilot.cloud` con certificado Let's Encrypt automático

---

## Bugs encontrados y corregidos en esta sesión

### Bug 1: GoTrue rechazaba login — "Invalid login credentials"
- **Causa:** El usuario insertado manualmente tenía `aud = 'authenticated'`.
  GoTrue sin `GOTRUE_JWT_AUD` configurado espera `aud = ''` (string vacío).
- **Fix:** `UPDATE auth.users SET aud = '' WHERE email = 'vendedor@iey.test'`

### Bug 2: GoTrue crasheaba — "converting NULL to string is unsupported"
- **Causa:** Campos `confirmation_token`, `recovery_token`, etc. eran NULL.
  Go no puede escanear NULL a un tipo `string`.
- **Fix:** `UPDATE auth.users SET confirmation_token = COALESCE(confirmation_token, ''), ...`

### Bug 3: Kong rechazaba requests — "Invalid authentication credentials"
- **Causa:** `kong.yml` tenía `${ANON_KEY}` y `${SERVICE_ROLE_KEY}` como placeholders
  que nunca fueron resueltos. Kong las usaba como strings literales.
  La ANON_KEY que Pato tenía en `.env.local` era un JWT real que Kong no reconocía.
- **Fix:** Generar JWTs reales firmados con el JWT_SECRET del stack (HS256, exp 2045).
  Actualizar `/opt/orion-stack/configs/supabase/kong.yml` con los valores reales.
  Backup en `kong.yml.backup`. Reiniciar Kong.

### Bug 4: PostgREST no encontraba relación predictions↔customers
- **Causa:** PostgREST cachea el schema al iniciar. Las tablas fueron creadas/movidas
  después del último reinicio, así que la FK no estaba en cache.
- **Fix:** `NOTIFY pgrst, 'reload schema'` — PostgREST recargó 65 relationships.

---

## Usuario GoTrue de test
- Email: `vendedor@iey.test`
- Password: `TestPassword123`
- UUID: `48be0415-f94a-4d6a-b94b-b79f9a377064`
- app_metadata: `{"tenant_id": "b815e5d6-2ef0-4d27-999b-8a7642b71183", "role": "vendedor"}`
- Campos críticos: `aud = ''`, todos los `*_token = ''` (no NULL)

---

## Riesgo abierto: search_path global

`ALTER DATABASE orion_db SET search_path TO auth, public` afecta TODAS las conexiones.
PostgREST no mostró conflictos (nuestras tablas no colisionan con las de `auth`),
pero si en el futuro se crean tablas con nombres como `users`, `sessions`, etc.,
habrá conflicto. La alternativa más segura sería:
```sql
ALTER DATABASE orion_db RESET search_path;
ALTER ROLE postgres IN DATABASE orion_db SET search_path TO auth, public;
```
Esto limitaría el search_path solo al usuario `postgres` (GoTrue), sin afectar
`authenticated`/`anon` (PostgREST). Evaluar en auditoría post-Fase 3.

---

## Archivos creados/modificados

### Nuevos (sesión 1 — código)
- `database/migrations/016_consolidate_to_orion_db.sql` + rollback
- `database/migrations/017_rls_dual_mode_and_permissions.sql` + rollback
- `frontend/` — proyecto Next.js completo (src/, components/, app/)

### Nuevos (sesión 2 — deploy)
- `frontend/Dockerfile` — multi-stage build
- `frontend/docker-compose.yml` — Traefik + red externa
- `frontend/.dockerignore`

### Modificados
- `frontend/next.config.ts` — `output: "standalone"`
- `frontend/.env.local` + `frontend/.env` — ANON_KEY real (JWT)
- `/opt/orion-stack/configs/supabase/kong.yml` — keys reales (requirió sudo)

---

## Test end-to-end (verificado en browser)

| Test | Resultado |
|------|-----------|
| Login vendedor@iey.test | ✅ |
| Redirect a /login sin sesión | ✅ (307) |
| KPI cards con datos reales | ✅ |
| Contactar Hoy carga predicciones | ✅ |
| Historial con filtros | ✅ |
| Datos muestra syncs | ✅ |
| HTTPS con certificado válido | ✅ |

---

## PRÓXIMO PASO OBLIGATORIO: Auditoría de seguridad pre-Fase 4

**ANTES de iniciar cualquier trabajo de Fase 4, ejecutar auditoría completa
de la Fase 3 usando los agentes internos de seguridad.**

### Alcance de la auditoría

1. **@security-guardian** — Auditoría general:
   - Verificar que no hay secrets hardcodeados en código commiteado
   - Revisar que `.env`, `.env.local`, `.dockerignore` están correctamente excluidos de git
   - Validar que la imagen Docker no contiene credenciales en ningún layer
   - Revisar el riesgo del `search_path` global y recomendar si aplicar el fix por role

2. **@db-architect** — RLS y permisos:
   - Re-verificar los 5 tests de seguridad RLS en orion_db (pueden haber cambiado con el search_path)
   - Verificar que `authenticated` solo puede SELECT (+ UPDATE predictions.status)
   - Verificar que `anon` no tiene acceso a ninguna tabla de datos
   - Confirmar que la función `get_current_tenant_id()` es fail-closed

3. **@security-guardian** — Kong y auth:
   - Verificar que las JWTs generadas tienen los claims correctos (role, iss, exp)
   - Confirmar que la SERVICE_ROLE_KEY no está expuesta en el frontend
   - Revisar que el kong.yml.backup no quede expuesto públicamente
   - Verificar CORS en Kong (que solo acepte requests de app.pymepilot.cloud)

4. **@nextjs-dashboard** — Frontend security:
   - Verificar que no hay data leaks en Server Components (datos de otros tenants)
   - Revisar que el middleware de auth cubre todas las rutas protegidas
   - Confirmar que las Server Actions validan sesión antes de mutar datos

### Prompt para iniciar auditoría

```
Auditoría de seguridad post-Fase 3 de PymePilot.
Lee el handoff en docs/handoffs/2026-02-23_fase3_implementation_session.md

La Fase 3 deployó el dashboard MVP en app.pymepilot.cloud.
Cambios principales que requieren auditoría:
1. Kong: keys JWT generadas manualmente (antes eran placeholders sin resolver)
2. GoTrue: usuario insertado manualmente con fixes en aud y tokens
3. search_path global en orion_db (auth, public) — riesgo para PostgREST
4. RLS dual-mode: JWT para dashboard + app.tenant_id para Python
5. Docker deploy: Dockerfile multi-stage, build args con NEXT_PUBLIC_ vars
6. Frontend: Supabase SSR con middleware de auth

Ejecutar auditoría completa con los 4 agentes antes de avanzar a Fase 4.
No se debe escribir código nuevo hasta que la auditoría pase con 0 CRITICAL y 0 HIGH.
```
