# Handoff: Sesión de Implementación Fase 2

**Fecha:** 2026-02-22
**Tipo:** Implementación (código)
**Commit:** `4d9e92a` — "feat: Fase 2 motor de reposición predictiva V2 end-to-end"
**Próxima sesión:** Post-implementación Fase 2 + preparar Fase 3

---

## Qué se hizo en esta sesión

### Fase 2 COMPLETA — Los 8 pasos implementados y testeados

| # | Archivo | Estado | Notas |
|---|---------|--------|-------|
| 1 | `database/migrations/014_v2_reposicion_fields.sql` | Ejecutado | stddev_days + UNIQUE dedup index |
| 2 | `backend/engine/connectors/sync.py` | Modificado | CTE + LAG() para stddev atómico con avg |
| 3 | `backend/engine/claude/client.py` | Creado | 4 capas control de costos |
| 4 | `backend/engine/db/queries.py` | Creado | 8 queries, todas testeadas con datos reales |
| 5 | `backend/config/prompts/reposicion.txt` | Creado | Prompt conversacional, 3-6 productos, tono por perfil |
| 6 | `backend/engine/verticales/base.py` | Creado | Template Method pattern, 5 abstractos + 4 defaults |
| 7 | `backend/engine/verticales/reposicion.py` | Creado | 5 factores de confianza ponderados |
| 8 | `backend/scripts/run_vertical.py` | Creado | CLI con --dry-run, --limit, --min-confidence, etc. |

Archivos adicionales modificados:
- `database/migrations/015_api_usage_table.sql` — tabla global para tracking de costos
- `backend/config/settings.py` — DAILY_TOKEN_LIMIT, MAX_TOKENS_PER_CALL
- `CLAUDE.md` — sección "Control de Costos Claude API"

### Tests end-to-end exitosos

1. **Dry-run:** Pipeline completo sin Claude — 2 candidatos procesados, scores y perfiles correctos
2. **Dedup:** Segunda corrida detectó predicciones existentes — 0 candidatos (correcto)
3. **Llamada real a Claude:** Mensaje generado para PhoneZone CABA — $0.005 USD
4. **Iteración de prompt:** Se ajustó de "1 producto" a "3-6 productos conversacional" por feedback de Pato

### Ajuste de prompt por feedback de Pato

Pato pidió dos cambios al prompt durante la sesión:
1. **Más productos:** "Hay clientes que tienen 3 a 6 productos estrella" → se cambió de "al menos 1" a "entre 3 y 6"
2. **Tono natural:** "Queda muy forzado el copy" → se reescribieron las instrucciones para que Claude agrupe, redondee y mencione de pasada en vez de recitar cantidades como factura

### API key de Anthropic configurada

- Pato creó cuenta en console.anthropic.com y cargó $5 USD
- Auto-recharge deshabilitado (nunca gasta más de lo cargado)
- Key guardada en `.env` (108 caracteres, permisos 600)
- Modelo: claude-sonnet-4-20250514

---

## Estado actual

- **Fase 0:** COMPLETADA
- **Fase 1:** 90% (pendiente: sync Contabilium → Cloudflare bloquea IP del VPS)
- **Fase 2:** IMPLEMENTACIÓN COMPLETA, testeada end-to-end
- **Consumo API hoy:** 2,969 tokens / $0.014 USD (5 llamadas incluyendo tests)
- **Predictions en DB:** 1 pending (PhoneZone CABA, reposicion)

### Migraciones ejecutadas

- 001-013: Fase 0 y 1 (tablas base, RLS, sync)
- 014: stddev_days_between_purchases + idx_predictions_dedup
- 015: api_usage (tabla global sin RLS)

---

## Qué queda pendiente

### Inmediato (próxima sesión)

1. **Correr con datos reales de IEY** — Cuando se resuelva el blocker de Contabilium/Cloudflare, hacer sync real y correr el motor con datos de producción. Los scores van a ser mucho más representativos con historial real (6 meses, cientos de órdenes).

2. **Atribución automática** — Las queries `get_predictions_for_attribution()` y `update_prediction_attribution()` están escritas pero NO hay un script/cron que las ejecute. Falta crear un job que:
   - Corra después del sync diario (5 AM)
   - Busque predicciones pending de los últimos 14 días
   - Cruce con compras nuevas del ERP
   - Marque como `converted` las que matcheen

3. **Resumen de ejecución** — La query `get_run_summary()` está lista pero no hay UI ni reporte que la use. Para Fase 3 (dashboard).

### Fase 3: Dashboard (según roadmap)

- Next.js 14+ App Router
- Login con Supabase Auth
- Vista de predicciones (tabla con filtros)
- KPIs: tasa de conversión, predicciones/día, costo acumulado
- Ver `docs/ROADMAP.md` Fase 3

### Tech debt conocido

- N+1 queries en sync.py (prioridad baja)
- 2 índices redundantes (migration pendiente)
- Log level por defecto en DEBUG (cambiar a INFO en producción)
- `_calculate_factors()` se llama 2 veces por candidato (en `calculate_confidence` y `build_metadata`) — cachear si afecta performance con muchos candidatos

### Blocker Fase 1 (sigue pendiente)

- Contabilium API → Cloudflare bloquea IP del VPS (173.249.9.56)
- Instrucciones para resolver: `docs/pendientes/contabilium_whitelist.md`
- Mientras tanto, Excel sync funciona como fallback

---

## Decisiones tomadas en esta sesión

- **4 capas de control de costos** (diseño de Pato): daily DB limit → per-call ceiling → post-call registro en finally → alertas por log
- **Fail-open si DB caída:** llamada a Claude se permite + log ERROR (Anthropic tiene sus propios rate limits como red de seguridad)
- **CTE con LAG() para stddev:** se calcula atómicamente con avg en una sola query UPDATE
- **max_tokens_response = 400** para reposición (espacio para 3-6 productos)
- **Prompt conversacional:** NO recitar cantidades como factura, agrupar y redondear naturalmente
- **api_usage tabla GLOBAL:** sin tenant_id, sin RLS. Solo INSERT+SELECT para pymepilot_app.

---

## Comandos útiles

```bash
# Ejecutar motor V2 (dry-run)
python backend/scripts/run_vertical.py --tenant-slug iey --dry-run

# Ejecutar motor V2 (real, limitado a N candidatos)
python backend/scripts/run_vertical.py --tenant-slug iey --limit 3

# Ver predicciones generadas
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "
  SELECT customer_id, confidence_score, priority, metadata->>'profile',
         LEFT(message_text, 80) FROM predictions
  WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183'
  ORDER BY created_at DESC;"

# Ver consumo API del día
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "
  SELECT SUM(tokens_total) as tokens, SUM(cost_usd) as costo
  FROM api_usage WHERE usage_date = CURRENT_DATE;"

# Limpiar predicciones de test
docker exec orion-menteax_postgres psql -U postgres -d postgres -c "
  DELETE FROM predictions
  WHERE tenant_id = 'b815e5d6-2ef0-4d27-999b-8a7642b71183';"
```

---

## Archivos clave

```
IMPLEMENTADOS EN ESTA SESIÓN:
  backend/engine/claude/client.py         — Claude API wrapper + 4 capas costos
  backend/engine/db/queries.py            — 8 queries SQL
  backend/engine/verticales/base.py       — Template Method pattern
  backend/engine/verticales/reposicion.py — V2 con 5 factores de confianza
  backend/config/prompts/reposicion.txt   — Prompt conversacional
  backend/scripts/run_vertical.py         — CLI entry point
  database/migrations/014_*.sql           — stddev + dedup index
  database/migrations/015_*.sql           — api_usage table

CONTEXTO (no modificados):
  backend/engine/db/connection.py         — Pool + tenant context
  backend/engine/core/logger.py           — Logger + sanitizer
  backend/engine/connectors/sync.py       — Sync (sí modificado: stddev CTE)
  backend/config/settings.py              — Settings (sí modificado: cost limits)

DOCUMENTACIÓN:
  docs/FASE2_PLAN.md                      — Plan aprobado
  docs/ROADMAP.md                         — Roadmap completo (9 fases)
  CLAUDE.md                               — Reglas de seguridad + costos
```
