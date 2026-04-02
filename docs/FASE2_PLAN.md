# Plan Fase 2: Motor Inteligente — V2 Reposición Predictiva

**Fecha:** 2026-02-22
**Estado:** APROBADO por Pato
**Plan detallado:** `~/.codex/plans/shiny-prancing-hedgehog.md`

---

## Objetivo

Crear el motor que analiza historial de compras y genera predicciones accionables:
"Contactá a Juan, necesita reponer 50 Fundas MagSafe en 5 días".

**Alcance:** 6 mejoras estratégicas + solo Contacto 1 de la secuencia de seguimiento.
Los seguimientos (Contacto 2, 3, Escalamiento) quedan para iteración 2.

---

## Arquitectura

```
run_vertical.py (CLI)
  └→ VerticalReposicion (extiende VerticalBase)
       ├→ queries.py → SQL: candidatos + contexto por producto
       ├→ Confidence score (5 factores)
       ├→ Priority (confianza + valor de negocio)
       ├→ ClaudeClient → mensaje personalizado por perfil
       └→ save_prediction() → INSERT en predictions
```

---

## 6 Mejoras Estratégicas Incluidas

1. **Predicción por PRODUCTO** — No solo "Juan necesita comprar" sino "Juan necesita 50 Fundas MagSafe"
2. **Ventana adaptativa** — Clientes regulares: contactar 5 días antes. Irregulares: 14 días antes.
3. **Prioridad por valor de negocio** — Clientes que facturan más suben de prioridad.
4. **Tracking de conversión automático** — Si el cliente compra después de una predicción, se atribuye sin intervención manual. No depende de que el vendedor marque nada.
5. **Perfiles de cliente** — VIP, Regular, En riesgo, Nuevo-recurrente. Claude ajusta el tono.
6. **Secuencia preparada** — Metadata con sequence_step/sequence_id para seguimientos futuros.

---

## 8 Archivos a Crear/Modificar (en orden)

| # | Archivo | Acción | Descripción |
|---|---------|--------|-------------|
| 1 | `database/migrations/014_v2_reposicion_fields.sql` | CREAR | stddev_days en customers + índice dedup en predictions |
| 2 | `backend/engine/connectors/sync.py` | MODIFICAR | Agregar cálculo de stddev_days en _update_derived_fields |
| 3 | `backend/engine/claude/client.py` | CREAR | Wrapper Claude API con retry + token tracking |
| 4 | `backend/engine/db/queries.py` | CREAR | 8 queries SQL para candidatos, contexto, perfiles, conversión |
| 5 | `backend/config/prompts/reposicion.txt` | CREAR | Prompt template (system + user) con perfiles |
| 6 | `backend/engine/verticales/base.py` | CREAR | VerticalBase (Template Method pattern) |
| 7 | `backend/engine/verticales/reposicion.py` | CREAR | V2 con confidence (5 factores) + priority + perfiles |
| 8 | `backend/scripts/run_vertical.py` | CREAR | CLI: --tenant-slug, --vertical, --limit, --dry-run |

---

## Confidence Score (5 factores)

| Factor | Peso | Cálculo |
|--------|------|---------|
| Regularidad | 35% | Coeficiente de variación (stddev/avg) |
| Cantidad de datos | 20% | 2 ordenes=0.2 ... 10+=1.0 |
| Recencia | 15% | Ratio días_desde_última / avg_days |
| Tendencia cantidad | 15% | Última qty vs promedio anterior |
| Antigüedad relación | 15% | Meses como cliente (12+=1.0) |

---

## Estilo de Mensajes (basado en el estilo probado de Pato)

**Estructura:** saludo personal + dato específico + oferta concreta + call to action

**Ejemplo original de Pato:**
> "Hola [Nombre], como estas? te escribo porque tengo registrado en sistema que
> estás próximo a fecha de reposición de mercadería, y de los productos que solés
> comprar hay algunos artículos que estamos medio bajos de stock hasta que llegue
> la carga, era para consultarte si querés que te reserve [PRODUCTOS] así te
> aseguro la mercadería. Avisame y ya te los separo para vos."

**Variaciones por perfil:**
- VIP: exclusividad ("te aviso antes que al resto")
- Regular: template probado (reserva de stock)
- En riesgo: interés genuino ("cómo te está yendo?")
- Nuevo-recurrente: bienvenida ("qué bueno que volviste")

---

## Secuencia de Seguimiento (diseñada, se implementa en Iteración 2)

| Paso | Cuándo | Acción |
|------|--------|--------|
| Contacto 1 | 7-14 días antes (adaptativo) | Mensaje principal (reserva de stock) — **SE IMPLEMENTA AHORA** |
| Contacto 2 | +3 días post fecha estimada | Recordatorio suave + info nueva |
| Contacto 3 | +7 días sin respuesta | Cambio de ángulo (preguntar por su negocio) |
| Escalar | +14 días sin compra | Pasa a V4 Recuperación |

---

## Costo Estimado

| Escenario | Candidatos/día | Costo/mes |
|-----------|---------------|-----------|
| Test | 5-10 | ~$0.05 total |
| IEY producción | 10-15 | ~$1.50-2.00 |

---

## Prerequisitos

- [x] Fase 1 completada (sync + auditoria)
- [ ] API key de Anthropic configurada en .env (Pato la saca de console.anthropic.com)
- [x] Dependencias Python instaladas (anthropic SDK ya en requirements.txt)

---

## Atribución de Resultados (100% automática)

**Principio:** PymePilot demuestra su valor sin depender de acciones manuales del vendedor.

**Flujo:**
```
PymePilot genera predicción para Juan
  → Sync diario trae compras nuevas del ERP
    → Si Juan compró dentro de 14 días de la predicción
      → Atribución automática: predicción → compra (monto, fecha, productos)
```

**Lógica de atribución:** Si existe una predicción (status 'pending' o 'contacted') para un
cliente, y ese cliente hace una compra dentro de los 14 días siguientes a la predicción,
la venta se atribuye a PymePilot. No requiere que el vendedor confirme nada.

**Métricas que esto genera para el panel de resultados:**
- Tasa de conversión: predicciones que resultaron en compra / total predicciones
- Facturación asistida: suma de montos de compras atribuidas
- Tiempo de respuesta: días promedio entre predicción y compra
- ROI: facturación asistida / costo de PymePilot

**Nota:** Puede sobreestimar ligeramente (incluye clientes que habrían comprado solos).
Cuando tengamos más datos, podemos refinar comparando contra un grupo de control
(clientes sin predicción que también compran).

---

## Verificación End-to-End

1. Migration 014 ejecutada OK
2. Sync recalcula stddev_days
3. `--dry-run` muestra candidatos, scores, perfiles
4. `--limit 1` genera 1 predicción real con mensaje
5. Re-run = 0 nuevas (de-duplicación funciona)
6. Verificar en DB: mensaje, score, priority, metadata
7. Verificar atribución: simular compra posterior → predicción marcada como 'completed'
