# Handoff: Sesión de Planificación Fase 2

**Fecha:** 2026-02-22
**Tipo:** Planificación (sin código)
**Próxima sesión:** Implementación Fase 2

---

## Qué se hizo en esta sesión

### 1. Auditoría Ronda 7 (4 agentes en paralelo)

Auditoría final pre-Fase 2 comparando contra Ronda 6:

| Agente | Ronda 6 | Ronda 7 | Veredicto |
|--------|---------|---------|-----------|
| Security Guardian | 0C 2H 5M 4L 2I | 0C **0H** 3M 4L 2I | APROBADO |
| Python Engine | 0C 4H 12M 8L 6I | 0C **0H** 5M 8L 5I | APROBADO CON CONDICIONES |
| DB Architect | 0C 2H 5M 6L 6I | 0C **0H** 2M 4L 6I | APROBADO CON CONDICIONES |
| API Integrations | 0C 0H 3M 4L 8I | 0C 0H **0M** 2L 8I | APROBADO |

**Resultado: 0 CRITICAL, 0 HIGH. Listo para Fase 2.**

Reportes guardados en:
- `.claude/agent-memory/security-guardian/audit-round7-final-fase1.md`
- `.claude/agent-memory/python-engine/audit-code-fase1-r7.md`
- `.claude/agent-memory/db-architect/audit-ronda7-final.md`
- `.claude/agent-memory/api-integrations/audit-code-fase1.md`

### 2. Diseño de Fase 2 con Pato

Sesión de diseño colaborativa donde se definió:

- **Flujo del motor:** buscar candidatos → evaluar confianza → generar mensaje → guardar
- **6 mejoras estratégicas** sobre el diseño base del roadmap
- **Estilo de mensajes** basado en el template probado de Pato en IEY
- **Secuencia de seguimiento** (3 contactos + escalamiento) — diseñada pero solo Contacto 1 se implementa ahora
- **Perfiles de cliente** para variar tono (VIP, Regular, En riesgo, Nuevo-recurrente)

---

## Estado actual

- **Fase 1:** 90% (pendiente: sync Contabilium, Cloudflare blocker)
- **Fase 2:** PLAN APROBADO, pre-implementación
- **Plan detallado:** `~/.claude/plans/shiny-prancing-hedgehog.md`
- **Plan resumen:** `docs/FASE2_PLAN.md`

---

## Para la próxima sesión: IMPLEMENTAR Fase 2

### Orden de implementación (8 pasos)

1. **Migration 014** — `stddev_days_between_purchases` en customers + índice dedup en predictions
2. **Modificar sync.py** — Agregar cálculo de stddev_days en `_update_derived_fields()`
3. **claude/client.py** — Wrapper Claude API (retry, token tracking, cost estimation)
4. **db/queries.py** — 8 queries SQL (candidatos, contexto por producto, perfiles, conversión)
5. **prompts/reposicion.txt** — Template del prompt con perfiles y placeholders
6. **verticales/base.py** — VerticalBase (Template Method pattern)
7. **verticales/reposicion.py** — V2 con confidence (5 factores), priority, perfiles
8. **scripts/run_vertical.py** — CLI entry point (--dry-run, --limit, --min-confidence)

### Prerequisitos pendientes

- [ ] **API key de Anthropic:** Pato la saca de console.anthropic.com → Settings → API Keys.
  Necesita crear cuenta + agregar crédito ($5 USD mínimo). Luego agregarla al `.env` del servidor.
  **Sin API key se puede avanzar con `--dry-run`** (todo menos llamar a Claude).

### Decisiones ya tomadas (no re-discutir)

- Mínimo 2 compras para predecir (no 3)
- Ventana adaptativa por cliente (no fija 7-14)
- Priority combina confianza + valor de negocio
- Solo Contacto 1 ahora, seguimientos en iteración 2
- Las 6 mejoras se incluyen todas
- Template Method pattern (no ABC puro)
- Una llamada a Claude por candidato (no batch)
- Prompt en archivo .txt separado (no hardcoded)
- **Atribución de conversión 100% automática** — predicción + compra dentro de 14 días
  = venta atribuida. SIN paso manual del vendedor. La compra se detecta del sync del ERP.
  Pato: "todo lo que depende de lo manual me genera desconfianza"
- **Kommo/WhatsApp es OPCIONAL** — PymePilot demuestra valor con sus propios datos,
  independiente de herramientas externas que el cliente use o no

### Tech debt conocido (no blocker)

- N+1 queries en sync.py (prioridad baja, ~90 queries con IEY)
- 2 índices redundantes (migration pendiente)
- Log level por defecto en DEBUG

---

## Archivos clave para la próxima sesión

```
LEER PRIMERO:
  docs/FASE2_PLAN.md                     — Plan resumen aprobado
  ~/.claude/plans/shiny-prancing-hedgehog.md — Plan detallado completo

REUTILIZAR (no modificar):
  backend/engine/db/connection.py        — get_db_connection(), get_tenant_id_by_slug()
  backend/engine/core/logger.py          — get_logger(), sanitize_text()
  backend/config/settings.py             — ANTHROPIC_API_KEY, CLAUDE_MODEL, CLAUDE_MAX_TOKENS
  backend/scripts/sync_erp.py            — Patrón de entry point a copiar

MODIFICAR:
  backend/engine/connectors/sync.py      — _update_derived_fields() (agregar stddev)

CREAR:
  database/migrations/014_v2_reposicion_fields.sql  (+rollback)
  backend/engine/claude/client.py
  backend/engine/db/queries.py
  backend/config/prompts/reposicion.txt
  backend/engine/verticales/base.py
  backend/engine/verticales/reposicion.py
  backend/scripts/run_vertical.py
```
