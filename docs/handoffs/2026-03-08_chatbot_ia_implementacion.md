# Handoff — Chatbot IA (PymePilot Asesor) Implementacion

**Fecha:** 2026-03-08
**Sesion:** Implementacion feature Chatbot IA del backlog Fase 10
**Estado:** COMPLETADO y deployado en produccion

---

## Que se hizo

Se implemento el Chatbot IA "PymePilot Asesor" segun el design doc
`docs/plans/2026-03-08-chatbot-ia-asesor-design.md`.

### Decision arquitectonica

El design doc proponia backend Python, pero no existia servidor web Python
(solo scripts batch). Se decidio implementar todo en Next.js API route
(TypeScript) porque:
- No requiere infraestructura nueva
- El patron de API route ya existia (push/subscribe)
- Supabase client ya configurado para queries
- Deploy identico al existente (bash deploy.sh)

### Archivos nuevos (13)

**Backend/API:**
- `frontend/src/app/api/chat/route.ts` — POST endpoint, Claude tool use loop
- `frontend/src/lib/chat/tools.ts` — 13 tools de consulta DB
- `frontend/src/lib/chat/types.ts` — Tipos compartidos

**Frontend:**
- `frontend/src/components/chat/chat-bubble.tsx` — Burbuja flotante (FAB)
- `frontend/src/components/chat/chat-panel.tsx` — Panel reutilizable
- `frontend/src/components/chat/chat-message.tsx` — Burbuja de mensaje
- `frontend/src/components/chat/chat-input.tsx` — Input + enviar
- `frontend/src/components/chat/chat-wrapper.tsx` — Provider + Bubble wrapper
- `frontend/src/contexts/chat-context.tsx` — Estado compartido React Context
- `frontend/src/app/(dashboard)/asesor/page.tsx` — Pagina fullscreen

**Database:**
- `database/migrations/040_chat_usage.sql` — Tabla con RLS
- `database/migrations/040_rollback.sql`

**Prompt:**
- `backend/config/prompts/asesor_chat.txt` — Referencia (el prompt real esta en route.ts)

### Archivos editados (4)
- `frontend/package.json` — Agregado @anthropic-ai/sdk
- `frontend/src/app/(dashboard)/layout.tsx` — ChatWrapper envuelve todo
- `frontend/src/components/layout/sidebar.tsx` — Agregado "Asesor IA" con icono Bot
- `frontend/package-lock.json` — Lockfile actualizado

### Commits
- `8f191ee` feat: chatbot IA PymePilot Asesor — 13 tools, burbuja flotante, /asesor

## Las 13 tools del chatbot

| Tool | Que resuelve |
|------|-------------|
| buscar_clientes | Buscar por nombre, estado, inactividad |
| facturacion | Total facturado en periodo, por cliente |
| top_clientes | Ranking de mejores clientes (usa client_rankings_secure) |
| historial_compras | Ultimas compras de un cliente con detalle |
| productos_mas_vendidos | Top productos por facturacion |
| productos_cliente | Top productos de un cliente (usa RPC existente) |
| clientes_por_producto | Quien compra un producto (agrupa variantes) |
| clientes_nuevos | Clientes nuevos en periodo |
| predicciones | Estado de predicciones por vertical/estado |
| valor_pymepilot | Valor monetario generado (usa RPC existente) |
| tendencia_mensual | Facturacion mensual recurrente vs nueva (usa RPC) |
| churn_mensual | Tasa de churn mensual (usa RPC existente) |
| resumen_negocio | Resumen general (4 queries en paralelo) |

## Decisiones tecnicas

1. **TypeScript en vez de Python:** No habia servidor web Python. Crear uno
   agregaba infraestructura innecesaria. La funcionalidad es identica.

2. **13 tools en vez de 15:** Se combinaron tools redundantes (facturacion_periodo
   + facturacion_cliente → facturacion). Se elimino comparar_periodos (Claude
   llama facturacion dos veces).

3. **Sin SQL custom:** El design doc incluia query_custom(sql_select) como
   tool. Se decidio no implementarlo por complejidad de seguridad. Las 13
   tools predefinidas cubren los casos de uso.

4. **Agrupacion de variantes:** clientes_por_producto agrupa por cliente
   sumando TODAS las variantes que matchean (colores, tamaños). Devuelve
   la lista de variantes incluidas para que Claude las mencione.

5. **Prompt sin markdown:** Se instruyó explicitamente a Claude a responder
   en texto plano (sin **, ##, listas). Tono argentino natural, como un
   socio hablando por WhatsApp. Una sola sugerencia de seguimiento.

6. **Conocimiento de PymePilot:** El system prompt incluye descripcion
   completa de cada pagina, KPI, vertical, y funcionalidad de la plataforma.

7. **Estado compartido via Context:** La burbuja flotante y /asesor comparten
   la misma conversacion. Al navegar entre paginas, los mensajes persisten.
   Se pierden al refrescar (intencional, segun design doc).

## Bugs encontrados y corregidos en sesion

1. **Claude decia "no tengo acceso":** El prompt original no mencionaba
   que tenia herramientas disponibles. Se agrego seccion "INSTRUCCION CRITICA"
   que le ordena siempre usar tools antes de decir que no puede.

2. **Busqueda literal de productos:** "baterias inalambricas" no agrupaba
   variantes por color. Se mejoro clientes_por_producto para devolver
   las variantes matcheadas y una nota explicativa.

3. **Formato markdown:** Claude respondia con ** y listas. Se agrego
   seccion "FORMATO DE RESPUESTA" prohibiendo markdown explicitamente.

4. **3 sugerencias genericas:** Se cambio a 1 sola sugerencia relevante
   al tema de la pregunta del usuario.

## Setup requerido para nuevos deploys

ANTHROPIC_API_KEY debe estar en `frontend/.env.local`. El deploy.sh
pasa --env-file al container. Variables opcionales:
- CHAT_DAILY_LIMIT (default 20)
- CHAT_MODEL (default claude-sonnet-4-20250514)
- CHAT_MAX_TOKENS (default 1000)

## Costos estimados

- Modelo: Claude Sonnet ($3/1M input, $15/1M output)
- Estimado: ~$0.50-1.00/mes con 20 preguntas/dia
- Tracking: tabla chat_usage (1 fila por pregunta, con tokens y costo)

## Proxima feature sugerida

**Pipeline CRM** — design doc en `docs/plans/2026-03-08-pipeline-crm-design.md`.
Tercer item del backlog Fase 10.

## Contexto relevante

- Crontab parcialmente desactivado (ver MEMORY.md)
- Ticket Contabilium pendiente (Jira, 2026-03-07)
- Deploy: `cd frontend && bash deploy.sh`
- Orden backlog: Tooltips (DONE) → Chatbot IA (DONE) → Pipeline CRM → Dashboard Metricas
