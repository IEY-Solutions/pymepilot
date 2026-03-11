# Handoff — Sesion 2026-03-11: Auditoria Pre-MVP (Pasos 1 y 2)

## Resumen de sesion

### Paso 1 — Auditoria general TOTAL (COMPLETADO + DEPLOYADO)

Se ejecutaron 4 agentes de auditoria en paralelo (frontend, backend, database, infra).
Se encontraron y corregieron todos los Criticals y Highs en 4 rondas.

**Ronda 1 — Criticals (3 corregidos):**
- C-01: Pipeline page.tsx ejecutaba mutaciones (sync RPC + expiracion + auto-move) en Server Component render — violacion de Next.js. **Fix:** movido a read-only, mutaciones solo en GET /api/pipeline.
- C-02: Migration 046 re-otorgaba SELECT/UPDATE en tabla tenants a authenticated, exponiendo erp_config con credenciales ERP. **Fix:** nueva migration 052 que revoca permisos y usa VIEW segura.
- C-03: Chatbot sin limite de longitud de mensaje ni historial. **Fix:** MAX_MESSAGE_LENGTH=5000, MAX_HISTORY_MESSAGES=10, prefijo anti-inyeccion.

**Ronda 2 — Security Highs (3 corregidos):**
- H-01 (DB): get_tenant_info_secure() sin SET search_path (search_path hijack). **Fix:** migration 053.
- H-02 (DB): sync_predictions_to_pipeline() con EXECUTE otorgado a PUBLIC. **Fix:** migration 053.
- H-03 (DB): get_total_sales() sin limite en p_months (DoS via scan historico). **Fix:** LEAST/GREATEST en migration 053.

**Ronda 3 — UX Highs (5 corregidos):**
- loading.tsx y error.tsx con tema claro (bg-white, bg-gray-200) en app con tema oscuro. **Fix:** reescritos con tema oscuro.
- metricas/loading.tsx y logros/loading.tsx idem. **Fix:** reescritos.
- Asesor IA no accesible desde bottom-nav mobile. **Fix:** agregado icono Bot.

**Ronda 4 — Remaining Highs (4 corregidos):**
- styled-jsx shimmer en contact-modal.tsx no funciona con Server Components. **Fix:** CSS keyframe en globals.css + Tailwind animate.
- console.error en pipeline-board.tsx y push-banner.tsx (3+3 statements). **Fix:** eliminados.
- Chat tools sin .limit() en queries potencialmente grandes. **Fix:** .limit(1000).
- Doble calculo de factores en reposicion.py y cross_sell.py. **Fix:** patron de cache en candidate dict.

**Commits:** 3d7d158 (Ronda 1-4), bc19bf0 (fix migration 053)
**Migraciones aplicadas:** 052, 053
**Deploy:** frontend rebuildeado y verificado OK

### Paso 2 — Auditoria API/conectores (COMPLETADO)

Se ejecutaron 3 agentes especializados en paralelo (contabilium, sync+smart, process_uploads).
5 hallazgos corregidos:

| ID | Severidad | Archivo | Fix |
|----|-----------|---------|-----|
| H-01 | HIGH | contabilium.py | `_parse_argentine_money` maneja int/float + deteccion formato por coma |
| H-02 | HIGH | contabilium.py | `skip_batch_pacing` en `_get()` evita doble delay en fetch_orders/customers dirigido |
| H-03 | HIGH | contabilium.py | Log debug cuando since_date se ignora en modo dirigido |
| M-01 | MEDIUM | contabilium.py | `_TOKEN_URL` usa `.removesuffix()` en vez de `.replace()` fragil |
| M-03 | MEDIUM | process_uploads.py | Descarga chunked con limite 50MB (antes cargaba todo en RAM) |
| M-04 | MEDIUM | contabilium.py | Mejor logging de tipo de excepcion en rate limit handler |
| M-05 | MEDIUM | sync.py | Documentacion de race condition en sync guard |
| L-04 | LOW | smart.py | Docstring corregido en `_normalize_date` |

**Commit:** f4c3fa5
**No requirio migraciones ni deploy** (cambios solo en backend Python)

### Verificacion GET-only y buenas practicas Contabilium
- Confirmado: solo existe `_get()` en ContabiliumConnector, no hay _post/_put/_delete
- ERPConnector ABC solo define metodos de lectura
- Rate limiting: SYNC_RATE_LIMIT_DELAY=2.0s (~5 req/10s), batch pacing 10s cada 20 req
- Backoff exponencial con max 3 reintentos en 429
- Techo diario: 5000 registros, max 1 sync API/dia/tenant
- Credenciales aisladas por tenant en erp_config JSONB

---

## Pendiente para proxima sesion

### Paso 1 — MEDIUMs sin corregir (~25 items)

**Frontend MEDIUMs:**
- M-01: `formatCurrency` en format.ts usa es-AR hardcoded (deberia ser configurable por tenant)
- M-02: revenue-chart.tsx y ticket-chart.tsx con `any` en payload.map (Recharts limita tipado)
- M-03: prediction-card.tsx sin manejar predictions con datos faltantes (null product_name, etc.)
- M-04: client-detail.tsx retryCount sin limite maximo
- M-05: Export PDF no maneja error de generacion (try/catch falta en caller)
- M-06: Import fuera de orden en export-pdf.tsx
- M-07: /datos page sin feedback visual durante upload
- M-08: Pipeline drag & drop no funciona bien en mobile (touch events)
- M-09: Chat input no deshabilita envio durante loading
- M-10: Metricas page sin skeleton loading para graficos individuales

**Backend MEDIUMs:**
- M-11: `get_run_summary` con parametro vertical reordenado puede romper callers existentes
- M-12: Logger sanitize_text no captura todos los patrones de credenciales
- M-13: Claude client retry deberia usar tenacity en vez de implementacion manual
- M-14: Vertical base `_calculate_factors` no tiene cache global (solo por candidato)

**Database MEDIUMs:**
- M-15: Algunos rollbacks no restauran permisos GRANT originales
- M-16: Falta indice en pipeline_cards(stage, tenant_id) para queries del Kanban
- M-17: chat_usage table sin indice en (tenant_id, usage_date) para consulta diaria

**Infra MEDIUMs:**
- M-18: Deploy script no hace health check post-deploy
- M-19: Backup script no verifica integridad del dump
- M-20: Logs de upload worker no rotan (pueden crecer indefinidamente)

**Nota:** Estos son los MEDIUMs encontrados en esta auditoria. Tambien existen MEDIUMs diferidos de auditorias previas listados en MEMORY.md.

### Paso 1 — LOWs (~27 items)
- Cleanup cosmético: imports no usados, formatMonth duplicada, type hints faltantes
- No bloquean MVP

### Pasos 3-5 — Bloqueados por ticket Contabilium
- **Paso 3:** Reconexion segura con Contabilium
- **Paso 4:** Sync manual incremental
- **Paso 5:** Sync de stock de deposito
- Ticket abierto en Jira Service Management (2026-03-07), sin respuesta

---

## Archivos modificados en esta sesion

### Nuevos
- `database/migrations/052_fix_tenants_security_branding.sql`
- `database/migrations/052_rollback.sql`
- `database/migrations/053_fix_security_definer_and_rpc_limits.sql`
- `database/migrations/053_rollback.sql`

### Modificados (Step 1 — deployados)
- `frontend/src/app/(dashboard)/pipeline/page.tsx` (read-only, sin mutaciones)
- `frontend/src/components/pipeline/pipeline-board.tsx` (useEffect sync-on-mount)
- `frontend/src/app/api/chat/route.ts` (limites + anti-inyeccion)
- `frontend/src/app/(dashboard)/loading.tsx` (tema oscuro)
- `frontend/src/app/(dashboard)/error.tsx` (tema oscuro)
- `frontend/src/app/(dashboard)/metricas/loading.tsx` (tema oscuro)
- `frontend/src/app/(dashboard)/logros/loading.tsx` (tema oscuro)
- `frontend/src/components/layout/bottom-nav.tsx` (Asesor en nav)
- `frontend/src/components/pipeline/contact-modal.tsx` (CSS keyframe shimmer)
- `frontend/src/app/globals.css` (shimmer keyframe)
- `frontend/src/components/push/push-banner.tsx` (sin console.error)
- `frontend/src/lib/chat/tools.ts` (.limit(1000))
- `backend/engine/verticales/reposicion.py` (cache factores)
- `backend/engine/verticales/cross_sell.py` (cache factores)
- `backend/engine/db/queries.py` (vertical param required)

### Modificados (Step 2 — commit f4c3fa5, no deployados)
- `backend/engine/connectors/contabilium.py` (5 fixes)
- `backend/engine/connectors/sync.py` (documentacion)
- `backend/scripts/process_uploads.py` (descarga chunked)
- `backend/engine/connectors/smart.py` (docstring)

---

## Estado del crontab
```
0 3 * * *   backup PostgreSQL                       # ACTIVO
30 5 * * *  freshness check                          # ACTIVO
# Todo lo demas DESACTIVADO hasta resolver ticket Contabilium
```
