# Copy Dinamico por Etapa del Pipeline

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Contexto:** El pipeline CRM muestra un copy estatico (el message_text de la prediccion original) en todas las etapas. El operador necesita un mensaje adaptado a cada fase del embudo para copiar, modificar y enviar al cliente por WhatsApp.

## Problema

El copy original fue generado para el primer contacto ("Hola, te escribo porque hace X dias que no pedis..."). Cuando la card avanza a seguimiento, cotizacion o cierre, ese mensaje ya no sirve. El operador tiene que inventar el mensaje desde cero.

## Solucion

Generar un copy nuevo con Claude cada vez que la card cambia de etapa (post-contacto). El copy se personaliza usando el historial de notas del timeline y se adapta estrategicamente a la etapa del embudo.

## Decisiones de diseno

| Pregunta | Decision | Razon |
|----------|----------|-------|
| Etapas con copy | en_seguimiento, por_cotizar, cotizacion_enviada | El copy original cubre a_contactar, vendido no necesita mensaje |
| Cuando se genera | Al cambiar de etapa | No bloquea al operador, se genera 1 vez por etapa |
| Contexto para Claude | Notas + vertical + cliente + copy anterior | Personalizar al maximo ("pudiste charlarlo con tu socio?") |
| Donde se guarda | pipeline_cards.stage_message_text (nueva columna) | YAGNI — no necesitamos historial de copies por etapa |
| Enfoque | Claude genera copy libre | Templates fijos no agregan valor real |

## Flujo de datos

```
Card cambia de etapa
  -> handleContact / handleCompleteFollowup / handleAdvance
    -> generateStageCopy(card, targetColumn, notes)
      -> Claude Sonnet (max_tokens: 300)
      -> UPDATE pipeline_cards SET stage_message_text = resultado
    -> Si Claude falla: mantener stage_message_text anterior o prediction.message_text
```

## Cambio en DB

```sql
-- Migracion 042
ALTER TABLE pipeline_cards ADD COLUMN stage_message_text TEXT;
```

Columna nullable. Se sobreescribe en cada cambio de etapa.

## Prompt por etapa

Claude recibe: nombre del cliente, vertical, etapa destino, copy original, notas del timeline, ultimo resultado de contacto.

| Etapa | Intencion del mensaje |
|-------|----------------------|
| en_seguimiento | Follow-up calido, referir a la conversacion anterior, mantener interes |
| por_cotizar | Confirmar que se prepara la cotizacion, pedir datos faltantes |
| cotizacion_enviada | Recordar la cotizacion, preguntar dudas, empujar al cierre |

El output es un mensaje de 2-4 oraciones para WhatsApp, en tono profesional pero cercano.

## UI en el modal

- Si existe `stage_message_text` -> mostrar con label "Mensaje sugerido para esta etapa"
- Si no -> mostrar `prediction.message_text` con label "Mensaje original"
- Boton de copiar al portapapeles

## Control de costos

- max_tokens: 300
- Registro en chat_usage (misma logica que adjustFollowupsWithClaude)
- 1 generacion por cambio de etapa (no por apertura de modal)
- Costo estimado: ~$0.003-0.005/generacion, ~$0.15-0.25/mes para IEY

## Seguridad

- No se envian datos sensibles a Claude (solo nombre, vertical, notas)
- Credenciales API solo en .env
- Costos controlados por 4 capas existentes (DAILY_TOKEN_LIMIT, MAX_TOKENS_PER_CALL, chat_usage, alertas)
