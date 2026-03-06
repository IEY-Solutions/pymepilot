# Handoff — Fase 10 Bloque C: Mejoras UX Dashboard

**Fecha:** 2026-03-06
**Commit:** `8da422a`
**Design doc:** `docs/plans/2026-03-06-fase10-bloque-c-ux-design.md`

---

## Que se implemento

### F1: Pagina /logros (COMPLETADA)
- 3 RPCs: `get_achievements`, `get_total_sales`, `get_streak_days` (migration 035)
- Server component + client component (patron metricas)
- 3 KPI cards: ventas atribuidas, monto atribuido, racha
- AchievementCard con patron del cliente (nuevo/fidelizando/recurrente/recuperado)
- Filtro por vertical (reutiliza VerticalFilter)
- Loading skeleton
- Navegacion: Trophy icon en sidebar + bottom-nav (6 items ahora)

### F3: Filtros avanzados en /contactar (COMPLETADA)
- Dropdown "Ordenar por" con 4 opciones: urgentes, importantes, potencial, recientes
- Rankings fetch en paralelo con predictions (Promise.all)
- Sort en JS (no SQL dinamico) — lista cerrada de opciones
- Map de revenue para lookup O(1)

### F4: KPI Ventas Realizadas en /metricas (COMPLETADA)
- Nueva card "Ventas del mes" con ordenes + monto + % vs mes anterior
- RPC get_total_sales reutilizada desde migration 035
- Grid KPIs cambiado a 5 columnas en desktop

### F2: Notificaciones Push (COMPLETADA + TESTEADA)
- Migration 036: tabla push_subscriptions (RLS + FORCE RLS)
- Service Worker: sw.js en /public, escucha 'push' + 'notificationclick'
- Push banner: aparece si Notification.permission === 'default'
- API route: /api/push/subscribe (valida auth, HTTPS, tenant_id)
- Backend sender: pywebpush + auto-cleanup de suscripciones expiradas (410/404)
- Orquestador: paso 3d post-verticales envia push con resumen
- Script setup_vapid.py para generacion segura de claves VAPID
- VAPID keys configuradas en .env y frontend/.env.local
- **Push testeado end-to-end: notificacion recibida en navegador**

---

## Archivos creados (14)

| Archivo | Rol |
|---------|-----|
| `database/migrations/035_achievements_and_sales_rpc.sql` | 3 RPCs |
| `database/migrations/035_rollback.sql` | Rollback |
| `database/migrations/036_push_subscriptions.sql` | Tabla push |
| `database/migrations/036_rollback.sql` | Rollback |
| `frontend/src/app/(dashboard)/logros/page.tsx` | Server component logros |
| `frontend/src/app/(dashboard)/logros/logros-content.tsx` | Client component logros |
| `frontend/src/app/(dashboard)/logros/components/achievement-card.tsx` | Card de logro |
| `frontend/src/app/(dashboard)/logros/loading.tsx` | Skeleton |
| `frontend/public/sw.js` | Service Worker |
| `frontend/src/components/push/push-banner.tsx` | Banner activacion push |
| `frontend/src/app/api/push/subscribe/route.ts` | API route suscripcion |
| `backend/engine/push/__init__.py` | Modulo push |
| `backend/engine/push/sender.py` | Sender pywebpush |
| `backend/scripts/setup_vapid.py` | Script generacion VAPID |

## Archivos modificados (10)

| Archivo | Cambio |
|---------|--------|
| `backend/main.py` | Import push, paso 3d, _send_push_notifications() |
| `frontend/Dockerfile` | ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY |
| `frontend/deploy.sh` | --build-arg VAPID key |
| `frontend/src/app/(dashboard)/layout.tsx` | PushBanner component |
| `frontend/src/app/(dashboard)/metricas/page.tsx` | RPC get_total_sales |
| `frontend/src/app/(dashboard)/metricas/metricas-content.tsx` | SalesRow + card Ventas |
| `frontend/src/app/(dashboard)/contactar/page.tsx` | customer_id + rankings fetch |
| `frontend/src/app/(dashboard)/contactar/contactar-content.tsx` | Sort dropdown 4 opciones |
| `frontend/src/components/layout/sidebar.tsx` | Trophy icon |
| `frontend/src/components/layout/bottom-nav.tsx` | Trophy icon |

---

## Fixes aplicados durante implementacion

1. **Prop sales innecesaria en LogrosContent** — eliminada (detectada por auditor)
2. **Plural duplicado en push message** — simplificado con variable `plural`
3. **Icon faltante en sw.js** — eliminada referencia a icon-192.png inexistente
4. **Permission denied push_subscriptions** — agregado GRANT UPDATE TO authenticated (upsert) + DELETE TO pymepilot_app (cleanup)
5. **VAPID key format** — Vapid.from_raw() en vez de string directo a webpush()
6. **VAPID keys truncadas en .env** — creado setup_vapid.py que escribe directamente

---

## Estado de migraciones aplicadas

- 035_achievements_and_sales_rpc.sql — APLICADA
- 036_push_subscriptions.sql — APLICADA (+ fix permisos UPDATE/DELETE en vivo)

---

## Pendientes / mejoras para proxima sesion

1. **Push banner automatico:** Actualmente el usuario tiene que suscribirse manualmente via Console. El banner aparece pero la logica de suscripcion necesita que el SW ya este registrado. Mejorar el flujo para que sea un solo click.
2. **Bottom nav 6 items:** Verificar visualmente en mobile real — puede quedar apretado.
3. **Timezone en get_streak_days():** Usa CURRENT_DATE sin timezone. Funciona para IEY (Argentina) pero podria necesitar parametro si hay tenants en otras zonas.
4. **/logros sin datos:** Hasta que no haya predicciones completed este mes, la pagina muestra estado vacio. Considerar mostrar datos historicos o un onboarding.
5. **pywebpush en requirements:** Agregar a requirements.txt si existe.

---

## Dependencias nuevas

- **pywebpush 2.3.0** instalado en backend/venv (+ py-vapid, http-ece, aiohttp)

## Env vars nuevas

- `.env`: VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS_EMAIL
- `frontend/.env.local`: NEXT_PUBLIC_VAPID_PUBLIC_KEY

---

## Crontab (sin cambios)

Los 5 jobs existentes siguen igual. El push se envia dentro del orquestador (5 AM), no necesita cron separado.
