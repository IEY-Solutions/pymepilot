# UI Explicativa — Tooltips informativos

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Prioridad:** Alta (Grupo C — primera feature)

---

## Vision

Agregar iconos de informacion (i) al lado de cada dato, KPI,
columna y grafico de la app. Al hacer hover (desktop) o tap (mobile)
se muestra una explicacion corta de que es ese dato y para que sirve.

## Diseno

### Componente reutilizable
- `<InfoTooltip text="..." />` — se agrega al lado de cualquier titulo/dato
- Icono: circulo con "i" en gris claro (no distrae)
- Desktop: hover para ver popover
- Mobile: tap para ver, tap afuera para cerrar
- Explicaciones: 1-2 lineas maximo

### Textos centralizados
Todas las explicaciones en un solo archivo `frontend/src/lib/tooltips.ts`
como diccionario. Facilita editar textos sin tocar componentes.

```typescript
export const TOOLTIPS = {
  // Home
  "home.predicciones_pendientes": "Cantidad de clientes que PymePilot...",
  "home.tasa_contacto": "Porcentaje de predicciones que...",
  // Metricas
  "metricas.revenue_recurrente": "Facturacion de clientes que...",
  "metricas.churn_rate": "Porcentaje de clientes que dejaron...",
  // ... etc
}
```

### Cobertura
Todas las paginas: Home, Contactar, Metricas, Datos, Historial, Logros.
Cada KPI, cada columna de tabla, cada grafico lleva su tooltip.

## Archivos

### Nuevos
- frontend/src/components/ui/info-tooltip.tsx — componente reutilizable
- frontend/src/lib/tooltips.ts — diccionario centralizado de textos

### Editados
- Todas las paginas del dashboard para agregar <InfoTooltip> a cada dato
