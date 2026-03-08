# Handoff — Brainstorming Features Backlog PymePilot

**Fecha:** 2026-03-08
**Sesion:** Brainstorming y diseno de 7 features del backlog
**Estado:** 4 design docs aprobados, listos para implementacion

---

## Que se hizo

Pato trajo su backlog de features desde Notion ("Features PymePilot —
Backlog de mejoras"). Se analizaron las 7 features, se priorizaron en
3 grupos, y se diseno cada una mediante brainstorming iterativo con
aprobacion de Pato en cada seccion.

## Priorizacion acordada

| Prioridad | Grupo | Features |
|-----------|-------|----------|
| 1 (Alta) | B — Inteligencia | Chatbot IA, Sync stock (bloqueada) |
| 2 (Alta) | C — Experiencia | Tooltips UI, Pipeline CRM Kanban |
| 3 (Media) | A — Dashboard | Ranking productos, Top 10 por cliente, Comparar periodos |

## Design docs generados (todos aprobados)

| Archivo | Feature | Complejidad |
|---------|---------|-------------|
| `docs/plans/2026-03-08-chatbot-ia-asesor-design.md` | Chatbot IA (PymePilot Asesor) | Alta |
| `docs/plans/2026-03-08-pipeline-crm-design.md` | Pipeline CRM Kanban | Alta |
| `docs/plans/2026-03-08-ui-tooltips-design.md` | Tooltips informativos UI | Baja |
| `docs/plans/2026-03-08-dashboard-metricas-design.md` | 3 features de dashboard | Media |

## Orden de implementacion sugerido

1. **Tooltips UI** — feature chica, mejora inmediata, buen warmup
2. **Chatbot IA** — alto impacto, independiente del resto
3. **Pipeline CRM** — el mas ambicioso, transforma la experiencia
4. **Ranking productos + Top 10 cliente + Comparar periodos** — mejoras incrementales
5. **Sync stock + reemplazo** — bloqueada hasta resolver ticket Contabilium

## Decisiones clave tomadas

### Chatbot IA
- Rol: asesor experto que conoce todos los datos del negocio (3 niveles)
- Interfaz: burbuja flotante + pagina /asesor (estado compartido)
- Memoria: dentro de la conversacion (se resetea al cerrar)
- Queries: hibrido (15 predefinidas + SQL custom con restricciones)
- Costos: 20 preguntas/dia, Sonnet, 1000 max tokens, ~$0.50-1.00/mes
- Identidad: "PymePilot esta pensando...", "PymePilot esta consultando tus datos..."
- Seguridad: solo SELECT, tenant_id obligatorio, timeout 5s, RLS activo

### Pipeline CRM
- Columnas: A contactar | Contactado | En seguimiento | Por cotizar | Cotizacion enviada | Vendido
- Drag & drop entre columnas
- Modal rapido al contactar: resultado (botones) + nota (opcional)
- Seguimientos automaticos: secuencia fija por vertical (default) + Claude ajusta si hay nota
- Cards vencidas: bajan al fondo despues de 3 dias, no desaparecen
- Sin filtros, pipeline completo siempre visible
- 3 tablas nuevas: pipeline_cards, followups, contact_notes

### Tooltips UI
- Componente reutilizable <InfoTooltip text="..." />
- Hover desktop, tap mobile
- Textos centralizados en tooltips.ts
- Cobertura: todas las paginas

### Dashboard/Metricas
- Ranking productos: tabla expandible similar a ranking clientes, filtro periodo
- Top 10 por cliente: expansion inline en ranking clientes, toggle unidades/monto
- Comparar periodos: dropdown arriba de /metricas, deltas en KPIs, lineas superpuestas en graficos

## Feature bloqueada

- **Sync stock + reemplazo:** Requiere endpoint de stock de Contabilium API.
  Bloqueada hasta resolver ticket Jira abierto (2026-03-07). No tiene design doc aun.

## Proximos pasos

1. Abrir sesion nueva citando este handoff
2. Elegir feature a implementar (sugerido: Tooltips UI primero)
3. Invocar skill writing-plans para crear plan de implementacion detallado
4. Implementar

## Contexto tecnico relevante

- Crontab parcialmente desactivado (ver MEMORY.md)
- Ticket Contabilium pendiente (Jira Service Management, 2026-03-07)
- Stack: Next.js 16 + Python 3.11 + PostgreSQL 15 + Claude API (Sonnet)
- Tenant activo: IEY (b815e5d6-2ef0-4d27-999b-8a7642b71183)
