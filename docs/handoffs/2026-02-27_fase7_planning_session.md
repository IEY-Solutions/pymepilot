# Handoff — Sesion de Planificacion Fase 7

**Fecha:** 2026-02-27
**Sesion:** Planificacion + aprobacion de plan de implementacion
**Status:** Plan aprobado, implementacion pendiente

---

## Que se hizo en esta sesion

1. **Design doc aprobado** — `docs/plans/2026-02-27-fase7-cross-sell-kpis-design.md`
2. **Plan de implementacion** creado y aprobado con 9 pasos en 2 sesiones
3. **Lectura de archivos clave** completada para entender patrones existentes

---

## Archivos leidos (patrones ya entendidos)

| Archivo | Patron relevante |
|---------|-----------------|
| `backend/engine/db/queries.py` | 10 queries existentes, patron conn+tenant_id+dict_row |
| `backend/engine/verticales/base.py` | Template Method, 5 abstractos + 4 con default |
| `backend/engine/verticales/reposicion.py` | Referencia para V3: 5 factores, build_prompt_data, metadata |
| `backend/engine/verticales/__init__.py` | VERTICAL_REGISTRY dict simple |
| `backend/main.py` | Pipeline: sync -> attribution -> verticals, _run_verticals loop |
| `backend/config/prompts/reposicion.txt` | Formato ===SYSTEM===...===USER=== con placeholders |

---

## Plan de implementacion (9 pasos, 2 sesiones)

### Sesion 1 — Backend (~2.5h)

| Paso | Que | Archivos | Estado |
|------|-----|----------|--------|
| 1 | Migracion 026: vistas materializadas + RPCs + indices | 2 nuevos | Pendiente |
| 2 | Queries Python: cross_sell_candidates + refresh_views | 1 mod (queries.py) | Pendiente |
| 3 | Vertical V3 + prompt cross_sell.txt | 2 nuevos + 1 mod (__init__.py) | Pendiente |
| 4 | Orquestador: refresh views + V3 semanal (lunes) | 1 mod (main.py) | Pendiente |
| 5 | Activar V3 para IEY + test real (~$0.01) | SQL directo | Pendiente |

### Sesion 2 — Frontend (~4h)

| Paso | Que | Archivos | Estado |
|------|-----|----------|--------|
| 6 | Pagina /metricas: KPIs + graficos Recharts | 8 nuevos + 2 mod | Pendiente |
| 7 | Ranking clientes expandible (tab Clientes) | 3 nuevos | Pendiente |
| 8 | Reportes Excel + PDF exportables | 3 nuevos + 1 mod | Pendiente |
| 9 | Chip cross_sell en vertical-filter | 1 mod | Pendiente |

---

## Decisiones ya tomadas

- **RPCs en PostgreSQL** (SECURITY DEFINER) para que PostgREST las exponga al frontend
- **Vistas materializadas** sin RLS, filtradas por tenant_id en las funciones RPC
- **V3 semanal** (lunes): check `weekday() != 0` en orquestador
- **Dynamic imports** para Recharts/xlsx/@react-pdf (bundle size)
- **Tabs** Rendimiento/Clientes en /metricas
- **co_purchases** con HAVING >= 3 (minimo 3 pedidos juntos)
- **client_rankings** con RANK() OVER PARTITION BY tenant_id

---

## Riesgos identificados

1. co_purchases puede estar vacia si pocos pedidos multi-item (V3 simplemente no genera candidatos)
2. pymepilot_app necesita GRANT para REFRESH MATERIALIZED VIEW
3. Bundle size frontend (+900kb) mitigado con dynamic imports
4. PostgREST necesita NOTIFY pgrst despues de crear RPCs

---

## Proxima sesion

Arrancar directamente con **Paso 1: Migracion 026**. Los patrones ya estan entendidos, no hace falta releer archivos.
