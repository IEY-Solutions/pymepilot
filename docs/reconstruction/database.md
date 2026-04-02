# Base de datos

## Tablas y responsabilidades

- `tenants`: identidad, segmento, modulos activos, configuracion ERP.
- `user_profiles`: rol y pertenencia de usuario al tenant.
- `customers`, `products`, `orders`, `order_items`: datos operativos.
- `predictions`: resultado del motor de seguimiento.
- `sync_log`: trazabilidad de sincronizaciones.
- `orchestrator_runs`: historial de ejecuciones diarias.

## Contrato de aislamiento

- El aislamiento vive en RLS y en el contexto de tenant.
- No se debe confiar solo en filtros de la app.
- Las consultas de lectura y escritura deben asumir multi-tenancy desde el
  disenio, no como parche posterior.

## Capa de queries

- `backend/engine/db/queries.py` concentra la logica SQL parametrizada.
- Esa capa es la que hay que leer primero cuando se reconstruye una regla
  de negocio que toca DB.
- Si una query se vuelve dificil de entender, conviene documentar el contrato
  antes de cambiar la implementacion.

## Migraciones

Agrupar mentalmente las migraciones por tema:

- fundacion del schema
- sync e ingestion
- motor de predicciones
- multi-tenant y RLS
- UI y metadatos de producto
- monitoreo y operacion

No reconstruir el futuro cronologicamente por numero de archivo; reconstruirlo
por contrato funcional.

## Validacion minima

- un tenant nuevo no ve datos de otro tenant
- un admin nuevo aparece en profile y auth
- una corrida de sync deja trazabilidad
- una corrida de orquestador deja estado reproducible
- las queries criticas tienen tests de regresion
