# Pipeline CRM — Kanban de seguimiento comercial

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Prioridad:** Alta (Grupo C — segunda feature del backlog)

---

## Vision

Pipeline visual tipo Kanban (estilo Kommo) donde el vendedor ve todo
el ciclo de venta de cada cliente, desde la sugerencia de PymePilot
hasta la venta cerrada. PymePilot programa los seguimientos
automaticamente, el vendedor solo ejecuta.

## Columnas del pipeline

```
| A contactar | Contactado | En seguimiento | Por cotizar | Cotizacion enviada | Vendido |
|   (auto)    |  (manual)  |    (auto)      |  (manual)   |     (manual)       | (manual)|
```

- **A contactar:** Predicciones generadas por PymePilot (automatico)
- **Contactado:** Vendedor marco como contactado (manual o drag)
- **En seguimiento:** Seguimientos programados por PymePilot (automatico)
- **Por cotizar:** Cliente pidio cotizacion (manual)
- **Cotizacion enviada:** Se envio cotizacion (manual)
- **Vendido:** Cliente compro, fin del pipeline (manual)

## Flujo de una card

```
PymePilot genera prediccion
    -> aparece en "A contactar"
        -> vendedor hace click o arrastra a "Contactado"
            -> modal rapido: resultado + nota opcional
                -> PymePilot genera seguimientos automaticos
                    -> card pasa a "En seguimiento"
                        -> seguimiento 1 de 3: HOY (badge naranja)
                        -> seguimiento 2 de 3: en 3 dias (gris)
                        -> seguimiento 3 de 3: en 8 dias (gris)
                            -> vendedor ejecuta seguimiento -> repite modal
                                -> cuando avanza -> "Por cotizar"
                                    -> "Cotizacion enviada"
                                        -> "Vendido"
```

## Logica de seguimientos

### Hibrido: secuencia fija + Claude ajusta con contexto

| Escenario | Comportamiento |
|-----------|---------------|
| Sin nota | Secuencia fija por vertical |
| Con nota | Claude analiza nota y ajusta plazos o salta etapas |
| Nota dice "pidio cotizacion" | Salta directo a "Por cotizar" |
| Nota dice "la semana que viene" | Un solo seguimiento a los 7 dias |

### Secuencias fijas por vertical (default sin nota)

| Vertical | Seguimiento 1 | Seguimiento 2 | Seguimiento 3 |
|----------|--------------|--------------|--------------|
| V2 Reposicion | 2 dias | 5 dias | 10 dias |
| V1 Activacion | 1 dia | 3 dias | 7 dias |
| V4 Recuperacion | 3 dias | 7 dias | 15 dias |
| V3 Cross-sell | 2 dias | 5 dias | 10 dias |

### Claude ajusta (cuando hay nota)

- Se llama a Claude con la nota del vendedor + contexto del cliente
- Claude responde: plazos ajustados y/o columna destino directa
- Usa Sonnet, ~200 tokens max, se registra en api_usage
- Si Claude falla -> se usa secuencia fija como fallback

## Cards vencidas

- Despues de 3 dias sin contactar, la card baja al fondo de "A contactar"
- Indicador visual "Vencida" (opacidad reducida o badge)
- Vendedor puede contactarla tarde o descartarla manualmente
- No desaparecen automaticamente del pipeline

## Card del pipeline — Info visible

Cada card muestra:
- Nombre del cliente
- Vertical (color: azul reposicion, verde activacion, naranja recuperacion, violeta cross-sell)
- Prioridad (badge)
- Hace cuanto esta en esa etapa
- En "En seguimiento": "Seguimiento 1/3 — Hoy" o "en 3 dias"
- Ultima nota (truncada, 1 linea)

## Modal al contactar/seguimiento

Se abre cuando:
- Vendedor hace click en una card de "A contactar"
- Vendedor arrastra card a "Contactado"
- Vendedor hace click en seguimiento activo

Contenido del modal:
- Resultado: botones rapidos ("Contesto" / "No contesto" / "Pidio cotizacion")
- Nota: campo de texto opcional
- Boton "Listo"

## Interacciones

- **Drag & drop:** arrastrar cards entre columnas
- **Click:** abre modal de accion segun la columna
- **Mover manualmente** a cualquier columna (equivale a cambiar estado)
- **Sin filtros:** se ve todo el pipeline completo siempre

## Archivos nuevos

### Backend
- backend/engine/pipeline/followup.py — logica de seguimientos (secuencias + Claude)
- backend/engine/pipeline/service.py — CRUD del pipeline

### Frontend
- frontend/src/app/(dashboard)/pipeline/page.tsx — pagina del pipeline
- frontend/src/components/pipeline/pipeline-board.tsx — board Kanban
- frontend/src/components/pipeline/pipeline-column.tsx — columna
- frontend/src/components/pipeline/pipeline-card.tsx — card individual
- frontend/src/components/pipeline/contact-modal.tsx — modal al contactar
- frontend/src/app/api/pipeline/route.ts — endpoints API

### Database
- database/migrations/041_pipeline.sql — tablas nuevas

## Tablas nuevas

### pipeline_cards
- id (UUID)
- tenant_id (FK tenants)
- prediction_id (FK predictions, nullable para cards manuales futuras)
- customer_id (FK customers)
- column_name (enum: a_contactar, contactado, en_seguimiento, por_cotizar, cotizacion_enviada, vendido)
- vertical (text)
- priority (int)
- is_expired (boolean, default false)
- created_at, updated_at
- RLS por tenant_id

### followups
- id (UUID)
- tenant_id (FK tenants)
- card_id (FK pipeline_cards)
- sequence_number (int: 1, 2, 3)
- scheduled_date (date)
- status (enum: pending, completed, skipped)
- created_at, completed_at
- RLS por tenant_id

### contact_notes
- id (UUID)
- tenant_id (FK tenants)
- card_id (FK pipeline_cards)
- result (enum: contesto, no_contesto, pidio_cotizacion)
- note_text (text, nullable)
- followup_id (FK followups, nullable — si fue en un seguimiento)
- created_at
- RLS por tenant_id
