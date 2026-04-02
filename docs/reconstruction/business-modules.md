# Modulos de negocio

## Mapa actual

| Modulo | Estado | Rol |
| --- | --- | --- |
| `seguimiento` | Produccion | Detecta oportunidades de contacto y genera acciones comerciales |
| `cotizaciones` | En diseno | Automatizacion de cotizaciones dentro del flujo comercial |
| `portal` | Planificado | Experiencia self-service para pedidos u operaciones equivalentes |

## Seguimiento

Este es el modulo que realmente sostiene el producto hoy.
Contiene las verticales:

- `reposicion`
- `activacion`
- `recuperacion`
- `cross_sell`

Regla importante: no separarlo en productos distintos hasta que exista una
segunda vertical o segmento con comportamiento verdaderamente distinto.

## Cotizaciones

- Debe tratarse como modulo, no como feature aislada.
- Si el comportamiento cambia poco por segmento, la diferencia va por
  configuracion de producto y no por duplicacion de codigo.
- El contrato futuro es poder activarlo o desactivarlo por tenant o plan.

## Portal

- Es un modulo de autoservicio, no un duplicado del dashboard.
- Debe compartir contratos tecnicos con el resto del sistema.
- No conviene crear una estructura por segmento antes de tener evidencia.

## Producto mayoristas

- Es el segmento productivo actual.
- El frontend y la documentacion deben hablar en terminos del producto
  real que usa el cliente, no de una abstraccion generica.
- Los proximos segmentos deben reutilizar la base tecnica, no redefinirla.

## Regla de crecimiento

Antes de agregar un modulo nuevo, responder estas tres preguntas:

1. Que problema resuelve.
2. Que cambia en el flujo actual.
3. Que parte del stack puede reutilizarse sin romper el resto.
