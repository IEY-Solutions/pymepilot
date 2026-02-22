# Prompt de inicio — Fase 3: Dashboard MVP

Copiar y pegar esto al iniciar una nueva sesion de Claude Code:

---

## Contexto

Soy Pato, estoy aprendiendo a programar. PymePilot es mi sistema de BI para distribuidores B2B en Argentina. El primer cliente es IEY (accesorios MagSafe).

**Estado actual:**
- Fase 0 (setup): COMPLETADA
- Fase 1 (conectores ERP): 90% (Cloudflare bloquea Contabilium, Excel funciona como fallback)
- Fase 2 (motor V2 reposicion): COMPLETADA + AUDITADA (2 rondas, 0 CRITICAL, 0 HIGH)
- **Fase 3 (dashboard): POR EMPEZAR**

## Que necesito

Arrancamos la **Fase 3: Dashboard MVP**. Necesito un dashboard web donde el vendedor de IEY vea la lista de clientes a contactar hoy con mensajes sugeridos por el motor.

**Antes de escribir codigo**, lee estos archivos para entender el contexto completo:

1. `CLAUDE.md` — Reglas de seguridad y protocolos (OBLIGATORIO)
2. `docs/ROADMAP.md` — Seccion "Fase 3: Dashboard MVP" (tareas 3.1 a 3.8)
3. `docs/handoffs/2026-02-22_fase2_audit_session.md` — Handoff mas reciente
4. `docs/PRD.md` — Requisitos de producto
5. `backend/engine/db/queries.py` — Query 8 (get_run_summary) lista para KPIs
6. `backend/engine/db/connection.py` — Patron de conexion con tenant context

## Stack definido en el roadmap

- **Next.js 14+** App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- **Supabase Auth** para login (ya esta en el Docker stack en /opt/orion-stack/)
- **Mobile-first** — el vendedor usa celular
- **PostgreSQL** — misma DB, mismas tablas, mismas RLS policies

## Entregables de Fase 3 (segun roadmap)

1. Proyecto Next.js inicializado en `frontend/`
2. Login con Supabase Auth (email + password)
3. Pagina principal con KPIs basicos
4. Pagina "Contactar Hoy" (la mas importante) — lista de predicciones con mensajes copiables
5. API routes (GET predictions, PATCH status, GET kpis, GET sync-status)
6. Pagina de historial con filtros
7. Pagina "Estado de Datos" (ultimo sync, salud del sistema)
8. Layout responsive: sidebar en desktop, bottom nav en celular

## Restricciones importantes

- El vendedor de IEY NO es tecnico — la UI debe ser simple e intuitiva
- **Mobile-first**: disenar para celular primero, despues desktop
- **Seguridad multi-tenant**: el JWT debe incluir tenant_id, las API routes deben filtrar por tenant
- **Solo lectura del backend Python**: el dashboard lee la DB, no ejecuta el motor
- Seguir TODOS los protocolos de CLAUDE.md (modo educativo, post-modificacion, etc.)

## Como empezar

Propone un plan de implementacion para Fase 3 (entra en modo plan). Empeza por investigar el stack de Supabase que ya tenemos corriendo para entender que servicios estan disponibles (Auth, PostgREST, etc.).
