# Handoff: Fase 10 — Bloque A (Limpieza DB + Sync + Orquestador)

**Fecha:** 2026-03-05
**Sesión:** Limpieza de datos de prueba, sync real Contabilium, verificación end-to-end
**Siguiente:** Fase 10 Bloque B — WhatsApp Cloud API + Atribución automática

---

## Resumen

Se limpió la DB de datos de prueba acumulados en fases 0-9, se ejecutó la primera
sync limpia desde Contabilium (solo PV mayorista 0003), y se corrió el orquestador
completo generando las primeras predicciones reales.

---

## Acciones realizadas

### 1. Limpieza de base de datos
- **Descubrimiento:** El backend escribía en `postgres` pero el frontend leía de `orion_db`
  (la DB correcta es `orion_db` — Supabase/PostgREST). El .env ya tenía `DATABASE_NAME=orion_db`
  pero el test inicial se corrió desde directorio incorrecto.
- Limpieza de ambas DBs (postgres y orion_db): customers, products, orders, order_items,
  predictions, sync_log, api_usage, upload_jobs, notifications
- Backup previo: `postgres_backup_20260304_234841.sql.gz`
- Tenant IEY preservado intacto

### 2. Sync Contabilium (PV mayorista)
- Conexión verificada OK (whitelisting de IP activo)
- Sync completa ejecutada exitosamente:
  - **126 clientes** (mayoristas del PV 0003)
  - **2,021 productos**
  - **283 órdenes** (FCA + FCB + COT, sin notas de crédito NCA/NCB)
  - **3,790 order_items**
- Vistas materializadas refrescadas manualmente (client_rankings, co_purchases)

### 3. Orquestador end-to-end
- Corrida manual exitosa con las 4 verticales:
  - **Reposición:** 20 predicciones
  - **Activación:** 2 predicciones
  - **Recuperación:** 2 predicciones
  - **Cross-sell:** 0 (solo corre los lunes, era jueves)
  - **Total:** 24 predicciones, $0.12 USD
- Crontab verificado: orquestador a las 5 AM, backup a las 3 AM

### 4. Revisión de métricas con Pato
- Explicación de KPIs: % recurrente, churn, ticket promedio, valor PymePilot
- Churn 100%: normal — marzo tiene solo 2 órdenes (mes en curso incompleto)
- Diferencia leve facturación vs Contabilium: notas de crédito excluidas (2 NCA/NCB)
- Explicación de tarjetas de predicción: prioridad (confidence × 0.6 + valor × 0.4),
  confidence score (5 factores ponderados), ventanas de contacto

---

## Hallazgos importantes

1. **Dos databases:** `postgres` (testing) y `orion_db` (producción/Supabase). Todo
   debe apuntar a `orion_db`. El .env ya está correcto.
2. **ImporteTotalNeto en Contabilium:** Para FCA incluye IVA, para COT es precio final.
   El naming es confuso pero los montos son correctos.
3. **24 predicciones de 126 clientes es normal:** Los filtros de ventana temporal
   son estrictos por diseño (±14 días para reposición). Los demás clientes irán
   apareciendo día a día a medida que entren en su ventana.
4. **MVs no se refrescan automáticamente en sync manual:** Solo el orquestador
   las refresca. Después de sync manual hay que hacer `REFRESH MATERIALIZED VIEW
   CONCURRENTLY client_rankings;` y `co_purchases`.

---

## Estado del sistema

- **DB:** Limpia, datos reales de Contabilium
- **Sync:** Funcional, crontab activo 5 AM
- **Orquestador:** Funcional, 24 predicciones generadas
- **Dashboard:** Mostrando datos reales correctos
- **Costo API acumulado:** $0.12 USD

---

## Para la próxima sesión: Bloque B

### Prioridad 1: WhatsApp Cloud API (Fase 6 Parte 2)
- Pato tiene el SIM chip listo
- Implementar notificación diaria automática al vendedor
- Necesita: configurar WhatsApp Business API, crear template de mensaje,
  integrar con el orquestador post-predicciones

### Prioridad 2: Atribución automática
- Si el cliente compró dentro de la ventana de predicción, marcar como
  convertida con attribution_amount
- Hoy "Valor PymePilot" está en $0 porque no existe esta lógica

### Después del Bloque B:
- Bloque C: Mejoras UX dashboard (estado "vendido", filtro por fecha, notificaciones in-app)
- Bloque D: Deuda técnica (formatMonth, COALESCE views, retryCount limit)
- P1 postergar: Afinación prompts, precisión predicciones, ventanas óptimas
  (requieren semanas de datos acumulados)

### Datos útiles
- **IEY tenant_id:** `b815e5d6-2ef0-4d27-999b-8a7642b71183`
- **DB correcta:** `orion_db` (NO `postgres`)
- **Clientes:** 126 | **Productos:** 2,021 | **Órdenes:** 283
- **Predicciones activas:** 24 (20 repo + 2 activ + 2 recup)
- **Vendedores IEY:** Aún no usan el dashboard activamente
- **SIM chip:** Disponible para WhatsApp Cloud API
