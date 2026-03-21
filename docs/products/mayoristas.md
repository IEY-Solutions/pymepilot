# PymePilot — Producto Mayoristas B2B

**Segmento:** Distribuidores mayoristas Argentina
**Estado:** En producción (cliente activo: IEY)
**Última actualización:** 2026-03-21

---

## Qué resuelve

Los distribuidores mayoristas trabajan con bases de clientes recurrentes que
compran en ciclos predecibles. El problema: sin un sistema, los vendedores
contactan tarde (el cliente ya compró a la competencia) o no contactan
(el cliente cae en el olvido).

PymePilot detecta el momento exacto de contacto para cada cliente y genera
el mensaje personalizado. El vendedor solo ejecuta.

**Validación IEY (6 meses):** facturación recurrente 34% → 74%, churn 18% → 8%.

---

## Módulos disponibles

| Módulo | Estado | Descripción |
|--------|--------|-------------|
| `seguimiento` | En producción | Reactivación, reposición predictiva, activación nuevos, cross-sell |
| `cotizaciones` | En desarrollo | Cotizaciones automáticas vía WhatsApp |
| `portal` | Planificado | Portal de pedidos self-service para clientes del distribuidor |

### Módulo: seguimiento

Las 4 verticales del motor de predicción. Todas corren a las 5 AM vía orquestador.

| Vertical | Frecuencia | Candidatos |
|----------|-----------|------------|
| `reposicion` | Diaria | Clientes cuya próxima compra cae en ventana 7-14 días |
| `activacion` | Diaria | Clientes nuevos en secuencia día 7/15/25 |
| `recuperacion` | Diaria | Clientes inactivos en ventanas 60/90/120 días |
| `cross_sell` | Semanal (lunes) | Top 5 por co-purchase score |

**Código:** `backend/engine/seguimiento/`
**Prompts:** `backend/config/prompts/` (reposicion.txt, activacion.txt, recuperacion.txt, cross_sell.txt)

---

## Usuarios

| Rol | Uso | Frecuencia |
|-----|-----|-----------|
| Vendedor | Ver lista diaria, copiar mensaje, enviar por WhatsApp | Diaria, mañana |
| Admin | KPIs, métricas, pipeline CRM, cuentas clave | Semanal |
| Super Admin (Pato) | Crear tenants, monitorear sistema | Según demanda |

---

## Flujo de datos

```
Contabilium API / Excel / Google Drive
  ↓ sync 5am
PostgreSQL (customers, products, orders)
  ↓ motor Python
predictions (mensajes personalizados)
  ↓ dashboard
Vendedor → copia mensaje → WhatsApp
```

---

## Configuración por tenant

```sql
-- Ver módulos activos de un tenant:
SELECT slug, segment, active_modules, active_verticals
FROM public.tenants WHERE active = true;

-- Activar un nuevo módulo para un tenant:
UPDATE public.tenants
SET active_modules = array_append(active_modules, 'cotizaciones')
WHERE slug = 'iey';
```

---

## Métricas de éxito

- % clientes reactivados / mes
- $ recuperado atribuible a predicciones
- Tiempo promedio entre detección y recompra
- Costo Claude API: < $5 USD/mes por tenant
