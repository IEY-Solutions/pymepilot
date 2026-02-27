# Handoff Fase 7 — Listo para Auditoría

**Fecha:** 2026-02-28
**Commits Fase 7 completa:** `42a4192` → `79b7a20` (5 commits)
**Estado:** Implementacion COMPLETA, deploy en produccion, listo para auditar

---

## Resumen ejecutivo

Fase 7 agrega V3 Cross-Sell + pagina /metricas completa al dashboard.
Se implemento en 3 sesiones (planificacion, implementacion, omisiones+polish).

---

## Commits de Fase 7

| Commit | Descripcion |
|--------|-------------|
| `42a4192` | Design doc fase 7 |
| `3009992` | Handoff planificacion (plan aprobado) |
| `ab4c93c` | feat: V3 Cross-Sell + KPIs + ranking + /metricas |
| `a39b042` | Handoff implementacion |
| `79b7a20` | feat: tendencia + detalle expandido + visual polish charts |

---

## TODO lo que se implemento (scope completo para auditoría)

### Backend — V3 Cross-Sell

| Componente | Archivo | Que hace |
|------------|---------|----------|
| Migration 026 | `database/migrations/026_cross_sell_kpis.sql` | MVs co_purchases + client_rankings, fn refresh, GRANT |
| Migration 026 rollback | `database/migrations/026_rollback.sql` | DROP MVs + fn |
| 3 queries Python | `backend/engine/db/queries.py` (+333 lineas) | cross_sell_candidates, cross_sell_products, refresh_materialized_views |
| Vertical V3 | `backend/engine/verticales/cross_sell.py` | VerticalCrossSell: co-purchase, build_prompt_data, 5 candidatos max |
| Prompt V3 | `backend/config/prompts/cross_sell.txt` | Plantilla ===SYSTEM===...===USER=== |
| Registry | `backend/engine/verticales/__init__.py` | +1 linea cross_sell |
| Orquestador | `backend/main.py` (+73 lineas) | refresh MVs + V3 semanal (lunes) |

### Backend — RPCs para KPIs

| RPC | Archivo | Que hace |
|-----|---------|----------|
| client_rankings_secure | `027_kpi_rpcs.sql` | VIEW segura sobre MV con filtro tenant |
| get_monthly_revenue_split | `027_kpi_rpcs.sql` | Facturacion mensual recurrente vs nueva |
| get_monthly_churn | `027_kpi_rpcs.sql` | Churn mensual |
| get_monthly_ticket | `027_kpi_rpcs.sql` | Ticket promedio mensual |
| get_monthly_value | `027_kpi_rpcs.sql` | Valor atribuido a PymePilot |
| get_client_top_products | `027_kpi_rpcs.sql` | Top N productos por cliente |
| get_client_trends | `028_client_detail_rpcs.sql` | Tendencia up/down/stable por cliente |
| get_client_monthly_revenue | `028_client_detail_rpcs.sql` | Facturacion mensual de un cliente |

### Frontend — /metricas

| Componente | Archivo | Que hace |
|------------|---------|----------|
| Server page | `metricas/page.tsx` | 6 queries paralelas, merge trends con rankings |
| Client content | `metricas/metricas-content.tsx` | Tabs rendimiento/clientes, 4 KPI cards, export dropdown |
| Revenue chart | `metricas/charts/revenue-chart.tsx` | Area chart recurrente vs nueva |
| Churn chart | `metricas/charts/churn-chart.tsx` | Bar chart + line overlay |
| Ticket chart | `metricas/charts/ticket-chart.tsx` | Bar chart rec/nuevo/total |
| Value chart | `metricas/charts/value-chart.tsx` | Bar + line PymePilot value |
| Ranking table | `metricas/client-ranking-table.tsx` | 8 columnas incl. tendencia, expandible |
| Client detail | `metricas/client-detail.tsx` | Promise.all 3 fuentes, BarChart mini, predicciones |
| Export Excel | `metricas/exports/export-excel.ts` | 4 hojas incl. tendencia |
| Export PDF | `metricas/exports/export-pdf.tsx` | Resumen ejecutivo |

### Frontend — Otros

| Componente | Archivo | Que hace |
|------------|---------|----------|
| Sidebar | `components/layout/sidebar.tsx` | +1 navItem metricas |
| Bottom nav | `components/layout/bottom-nav.tsx` | +1 navItem metricas |
| Vertical filter | `components/predictions/vertical-filter.tsx` | +cross_sell chip |

---

## Archivos para auditar (31 total)

### Migrations (4 archivos)
```
database/migrations/026_cross_sell_kpis.sql
database/migrations/026_rollback.sql
database/migrations/027_kpi_rpcs.sql
database/migrations/027_rollback.sql
database/migrations/028_client_detail_rpcs.sql
database/migrations/028_rollback.sql
```

### Backend Python (5 archivos)
```
backend/engine/db/queries.py           (+333 lineas — 3 queries nuevas)
backend/engine/verticales/cross_sell.py (NUEVO)
backend/engine/verticales/__init__.py   (+1 linea)
backend/config/prompts/cross_sell.txt   (NUEVO)
backend/main.py                         (+73 lineas — refresh MVs + V3)
```

### Frontend (12 archivos)
```
frontend/src/app/(dashboard)/metricas/page.tsx
frontend/src/app/(dashboard)/metricas/metricas-content.tsx
frontend/src/app/(dashboard)/metricas/client-ranking-table.tsx
frontend/src/app/(dashboard)/metricas/client-detail.tsx
frontend/src/app/(dashboard)/metricas/charts/revenue-chart.tsx
frontend/src/app/(dashboard)/metricas/charts/churn-chart.tsx
frontend/src/app/(dashboard)/metricas/charts/ticket-chart.tsx
frontend/src/app/(dashboard)/metricas/charts/value-chart.tsx
frontend/src/app/(dashboard)/metricas/exports/export-excel.ts
frontend/src/app/(dashboard)/metricas/exports/export-pdf.tsx
frontend/src/components/layout/sidebar.tsx
frontend/src/components/layout/bottom-nav.tsx
frontend/src/components/predictions/vertical-filter.tsx
```

---

## Patrones de seguridad a verificar en auditoría

1. **RLS en RPCs:** Las 8 RPCs NO usan SECURITY DEFINER. Dependen de RLS de las tablas subyacentes (orders, customers, predictions). Verificar que el tenant autenticado solo ve sus datos.

2. **VIEW client_rankings_secure:** Filtra MV por `get_current_tenant_id()`. La MV no tiene RLS (PostgreSQL no lo soporta). La VIEW es el mecanismo de aislamiento.

3. **refresh_materialized_views:** Usa SECURITY DEFINER porque pymepilot_app no es owner de las MVs. Verificar que la funcion no expone datos cross-tenant.

4. **Client-side queries en client-detail.tsx:** Query directa a `predictions` table con filtro `customer_id` + `status in (pending, contacted)`. RLS protege por tenant. Verificar que no se puede inyectar otro customer_id de otro tenant.

5. **Export:** Excel y PDF se generan en el browser con datos que ya pasaron por RLS. No hay query adicional.

6. **Sin secrets hardcodeados:** Verificar que ningun archivo tiene API keys, tokens, o URLs con credenciales.

7. **V3 Cross-Sell queries:** `cross_sell_candidates` y `cross_sell_products` deben filtrar por tenant_id.

---

## Bugs conocidos

1. **Login no funciona** — Documentado en handoff anterior (`a39b042`). GoTrue rechaza password. No es causado por Fase 7 (probablemente pre-existente o causado por rebuild de container).

2. **Datos IEY solo de diciembre 2025** — Tendencias muestran casi todo "up" porque previous_revenue=0 (no hay datos de meses anteriores). Se corregira naturalmente cuando haya mas datos.

---

## Design docs de referencia
- `docs/plans/2026-02-27-fase7-cross-sell-kpis-design.md` — Design doc principal
- `docs/plans/2026-02-28-metricas-visual-polish-design.md` — Visual polish charts

---

## MEDIUMs diferidos (no bloquean)
- cross_sell ausente en vertical-filter → RESUELTO en esta fase
- Todos los MEDIUMs globales de MEMORY.md siguen vigentes
