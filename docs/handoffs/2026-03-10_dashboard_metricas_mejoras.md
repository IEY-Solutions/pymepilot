# Handoff — Dashboard Métricas Mejoras

**Fecha:** 2026-03-10
**Sesion:** Mejoras dashboard /metricas (3 features)
**Commit:** a519416

## Que se hizo

### 1. Pestaña "Comparar"
- Compara KPIs entre periodos: mes vs anterior, trimestre vs trimestre, rangos custom (4/6/9/12 meses)
- Tabla de KPIs con variacion porcentual (verde positivo, rojo negativo)
- Graficos de Revenue y Ticket Promedio con datos del rango seleccionado
- Componente CompareTab dentro de metricas-content.tsx

### 2. Pestaña "Productos"
- Ranking global de productos por monto facturado o unidades vendidas
- Toggle para alternar entre ordenamiento por monto y por unidades
- Muestra SKU, barra proporcional, valores de ambas metricas
- Componente nuevo: product-ranking-table.tsx
- RPC nueva: get_product_rankings() (migration 045)

### 3. Top 10 por cliente
- Aumentado de top 5 a top 10 en client-detail.tsx
- Toggle para ordenar por monto facturado o unidades vendidas
- Barra visual adapta al criterio activo
- RPC get_client_top_products actualizada con default limit 10

## Archivos modificados/creados

| Archivo | Cambio |
|---------|--------|
| `database/migrations/045_product_rankings_rpc.sql` | RPC get_product_rankings + update get_client_top_products |
| `database/migrations/045_rollback.sql` | Rollback |
| `frontend/src/app/(dashboard)/metricas/product-ranking-table.tsx` | Componente nuevo |
| `frontend/src/app/(dashboard)/metricas/client-detail.tsx` | Top 10 + toggle sort |
| `frontend/src/app/(dashboard)/metricas/metricas-content.tsx` | 4 tabs + CompareTab |
| `frontend/src/app/(dashboard)/metricas/page.tsx` | 12 meses + productRankings prop |

## Decisiones tecnicas
- get_product_rankings() SIN SECURITY DEFINER (para que get_current_tenant_id() funcione)
- Todas las RPCs piden 12 meses (antes 6) para alimentar la pestaña Comparar
- Ordenamiento de productos es client-side (frontend sort) — la RPC devuelve todo ordenado por revenue DESC

## Pendiente
- Nada bloqueante de esta sesion
- MEDIUMs diferidos: `any` residual en CompareTab avgField/sumField (Recharts limita tipos)

## Deploy
- Migration 045 ejecutada en orion_db
- Frontend rebuildeado y desplegado via Docker Compose
