# Contratos tecnicos

## Tenant y aislamiento

- Cada tenant tiene identidad propia en la tabla `tenants`.
- El JWT debe llevar `app_metadata.tenant_id` para que RLS filtre bien.
- El contexto de tenant se setea en cada conexion a DB antes de leer o
  escribir datos.
- El onboarding debe terminar con un tenant activo, un admin valido y RLS
  verificado.

## Auth y frontend

- El dashboard usa Supabase SSR auth.
- El middleware protege rutas y evita exponer pantallas sin sesion.
- El login no debe depender de rutas manuales ni de pasos no idempotentes.

## Sync y fuentes de datos

- Contabilium se consume en modo solo lectura.
- Excel y Google Drive alimentan los tenants que no tienen API directa.
- El sync debe ser repetible y tolerar reintentos sin duplicar datos.
- `sync_log` y los conteos por tenant son parte del contrato operativo.

## IA y prompts

- Los prompts viven agrupados por modulo, no dispersos por feature.
- La seleccion del modelo tiene politica propia y no debe decidirse a mano
  en cada script.
- `backend/engine/model_context.py` y `backend/engine/model_router.py`
  implementan el contrato de routing de modelo.
- El flujo de IA debe registrar costo, tokens y fallas con trazabilidad.

## Routing y presentacion

- La capa de producto decide que superficie ve cada segmento.
- `docs/products/mayoristas.md` describe el producto actual y sus modulos.
- `docs/modules/*.md` describe las fronteras funcionales de cada modulo.

## Reglas para un modulo nuevo

1. Crear el contrato del modulo en backend.
2. Agregar prompts y registry.
3. Definir como aparece en el producto.
4. Verificar tenancy, RLS y monitoreo antes de exponerlo.
