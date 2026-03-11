# Excel de propuesta de reposicion por cliente

**Fecha:** 2026-03-11
**Estado:** Aprobado

---

## Objetivo

Generar un Excel descargable desde el pipeline que funcione como propuesta
de reposicion para enviarle directamente al cliente. Incluye los SKUs que
el cliente repone con frecuencia, cantidad sugerida, y una argumentacion
en segunda persona basada en su historial de compras.

## Donde se dispara

Boton "Generar propuesta" en el modal del pipeline (contact-modal.tsx).
Solo visible para tarjetas de vertical reposicion. Al hacer click,
descarga un .xlsx.

## Fuente de datos

RPC `get_client_demand_detail(p_customer_id)` — misma que usa la
pestana Demanda > Por Cliente en /metricas. Se filtran solo SKUs con
`purchase_count >= 2` (patron confiable de reposicion).

## Estructura del Excel

- **Fila 1:** "Propuesta de reposicion segun tus ultimas ordenes"
  (titulo, texto grande, fondo teal #81b5a1, texto blanco, mergeado)
- **Fila 2:** Nombre del cliente + fecha
- **Fila 3:** Vacia (separador)
- **Fila 4:** Headers (fondo #1a2a2c, texto blanco):
  SKU | Articulo | Cantidad sugerida | Detalle
- **Filas 5+:** Un SKU por fila, solo los de 2+ compras
- **Final:** "Generado por PymePilot — pymepilot.cloud" (gris, discreto)

## Columna Detalle

Texto automatico en segunda persona, fondo suave teal (#e8f5f0):

- purchase_count -> "Compraste este articulo N veces"
- last_order_date + last_quantity -> "Tu ultima compra fue el DD/MM con X unidades"
- frequency_days -> "Compras en promedio cada N dias" (si existe)

## Boton en el modal

- Icono FileSpreadsheet + "Generar propuesta"
- Fondo gradiente teal (from-[#81b5a1] to-[#5a9a84])
- Animacion shimmer al montar (llama la atencion sin molestar)
- Hover: scale-105 + sombra teal
- Solo visible si vertical === "reposicion"

## Implementacion

- Nuevo archivo: `frontend/src/lib/exports/export-proposal.ts`
- Usa libreria `xlsx` (ya instalada)
- Llamada RPC client-side desde el modal
- Archivo: `propuesta-reposicion-{nombre}-{YYYY-MM-DD}.xlsx`

## Decisiones

- Sin precios (el operador los maneja aparte)
- Sin branding de la empresa (solo PymePilot discreto)
- Solo SKUs con 2+ compras (confianza alta)
- Texto generado con datos reales (sin IA, sin costo)
