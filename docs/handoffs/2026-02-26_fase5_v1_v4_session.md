# Handoff — Fase 5: Verticales V1 Activacion + V4 Recuperacion

**Fecha:** 2026-02-26
**Commit:** `ddd4226`
**Sesion:** Implementacion completa + limpieza de datos duplicados
**Proximo:** Auditoria con agentes internos

---

## Que se hizo

### Implementacion (8 pasos del plan aprobado)

1. **Queries SQL** (`queries.py`): 2 funciones nuevas al final del archivo
   - `get_activation_candidates()`: clientes con 1 compra en ventana 7/15/25 dias
   - `get_recovery_candidates()`: clientes inactivos en ventana 60/90/120 dias
   - Ambas con tenant_id explicito, NOT EXISTS para dedup, CASE para calcular sequence_day/window_days

2. **VerticalActivacion** (`activacion.py`): clase nueva, 3 factores de confianza
   - first_order_amount (40%): normalizado contra $500k
   - product_variety (35%): 1→0.3, 2→0.5, 3→0.7, 4+→0.9
   - sequence_day (25%): dia 7→0.8, 15→0.5, 25→0.3
   - classify_profile() siempre retorna 'Nuevo'

3. **VerticalRecuperacion** (`recuperacion.py`): clase nueva, 4 factores de confianza
   - purchase_history (30%): compras + monto combinados
   - regularity (25%): CV = stddev/avg (reutiliza logica de V2)
   - inactivity_window (25%): 60d→0.8, 90d→0.5, 120d→0.2
   - tenure (20%): meses/12, cap 1.0 (reutiliza logica de V2)
   - classify_profile() usa default de base.py (VIP/Regular/En riesgo/Nuevo-recurrente)

4. **Prompts** (`activacion.txt`, `recuperacion.txt`): formato identico a reposicion.txt
   - Separador ===SYSTEM=== / ===USER===
   - Tono adaptado por dia de secuencia (V1) o ventana de inactividad (V4)
   - Espanol argentino, max 5 oraciones + cierre

5. **VERTICAL_REGISTRY** (`__init__.py`): 2 entradas nuevas

6. **DB IEY**: `active_verticals` actualizado a `["reposicion", "activacion", "recuperacion"]`

7. **Dashboard**:
   - `contactar-content.tsx` (nuevo): client component con estado de filtro
   - `vertical-filter.tsx` (nuevo): chips de filtro por vertical con conteo
   - `prediction-card.tsx` (modificado): badge con color por vertical + contexto (Dia 7, 90d)
   - `page.tsx` (modificado): agrega `metadata` al select, delega a ContactarContent

8. **Testing E2E**:
   - V1 dry-run: 9 candidatos (antes de limpieza de duplicados)
   - V4 dry-run: 2 candidatos
   - Orquestador dry-run: 3 verticales procesadas sin errores
   - V4 produccion: 2 mensajes generados ($0.008 USD)
   - Frontend rebuild + deploy OK

### Limpieza de datos duplicados

**Problema encontrado:** Los mismos clientes existian 3 veces en la DB:
- Contabilium API (external_id numerico largo, ej: `115114968`)
- Excel manual (external_id corto, ej: `31`)
- Smart File Upload (external_id `su_xxxx`)

**Causa raiz:** Cada canal de ingesta genera external_ids diferentes y el upsert usa external_id como clave unica.

**Acciones:**
- 12 predictions duplicadas borradas
- 42 ordenes de smart_upload reasignadas al customer de Contabilium (por match de nombre)
- 64 registros duplicados eliminados (32 excel + 32 smart_upload)
- Campos derivados de customers recalculados (total_purchases_count, amounts, etc.)
- Despues de la limpieza: 165 clientes (solo Contabilium)

**NOTA:** Esta limpieza fue en DB directa, no hay migracion SQL. Si se vuelve a subir un Excel o Smart File Upload con los mismos datos, se volveran a crear duplicados. Esto es un problema de diseño de la ingesta que deberia resolverse en una iteracion futura (matching por nombre en vez de solo por external_id).

---

## Archivos afectados

| # | Archivo | Tipo | Lineas |
|---|---------|------|--------|
| 1 | `backend/engine/db/queries.py` | Modificado | +186 |
| 2 | `backend/engine/verticales/activacion.py` | Nuevo | 197 |
| 3 | `backend/engine/verticales/recuperacion.py` | Nuevo | 204 |
| 4 | `backend/config/prompts/activacion.txt` | Nuevo | 33 |
| 5 | `backend/config/prompts/recuperacion.txt` | Nuevo | 38 |
| 6 | `backend/engine/verticales/__init__.py` | Modificado | +2 |
| 7 | `frontend/src/app/(dashboard)/contactar/contactar-content.tsx` | Nuevo | 70 |
| 8 | `frontend/src/app/(dashboard)/contactar/page.tsx` | Modificado | reescrito |
| 9 | `frontend/src/components/predictions/prediction-card.tsx` | Modificado | +30 |
| 10 | `frontend/src/components/predictions/vertical-filter.tsx` | Nuevo | 65 |

**Total: 10 archivos, 972 lineas agregadas, 54 removidas.**

---

## Estado de la DB post-sesion

```
predictions hoy:
  reposicion:   32 (con mensaje)
  recuperacion:  2 (con mensaje, $0.008 USD)
  activacion:    0 (sin candidatos en ventana hoy)

customers: 165 (solo Contabilium, duplicados eliminados)
tenants.active_verticals IEY: ["reposicion", "activacion", "recuperacion"]
```

---

## Puntos para la auditoria

### Seguridad
- [ ] Queries con tenant_id explicito (doble capa sobre RLS)
- [ ] NOT EXISTS + indice UNIQUE para dedup
- [ ] Prompts sin datos sensibles
- [ ] Metadata no expone PII adicional
- [ ] Sin escritura al ERP
- [ ] Exclusion V2↔V4 (NOT EXISTS reposicion en query de recuperacion)

### Logica de negocio
- [ ] Ventanas V1: +/-1 dia (6-8, 14-16, 24-26)
- [ ] Ventanas V4: +/-2 dias (58-62, 88-92, 118-122)
- [ ] Graduacion V1: cliente con 2+ compras sale automaticamente (total_purchases_count = 1)
- [ ] Dedup por metadata: sequence_day (V1) y window_days (V4)
- [ ] Factores de confianza: rangos y pesos segun design doc

### Frontend
- [ ] Chips de filtro client-side (no recarga)
- [ ] Badges con color correcto por vertical
- [ ] Contexto en badge (Dia 7, 90d)
- [ ] metadata incluida en select de Supabase

### Conocidos / Pendientes
- **Error pre-existente en atribucion:** `IndeterminateDatatype` en `update_prediction_attribution()` — NO introducido por Fase 5
- **Duplicados de ingesta:** Si se sube otro Excel/Smart File Upload se vuelven a crear duplicados. Necesita fix en la capa de ingesta (matching por nombre)
- **V1 sin candidatos hoy:** Los clientes mas cercanos entran en ventana en 2 dias (FundaMaster, dia 25). Funcionalidad verificada con dry-run antes de la limpieza de duplicados.

---

## Design doc de referencia

`docs/plans/2026-02-26-fase5-v1-v4-design.md` — Aprobado por Pato antes de implementar.
