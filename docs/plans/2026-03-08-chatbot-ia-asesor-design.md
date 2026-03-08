# Chatbot IA — PymePilot Asesor

**Fecha:** 2026-03-08
**Estado:** Aprobado
**Prioridad:** Alta (Grupo B — primera feature del backlog)

---

## Vision

PymePilot funciona como un asesor experto de negocios en tiempo real.
El vendedor puede preguntar lo que quiera sobre sus datos y recibir
respuestas accionables basadas en informacion real de la DB.

## Niveles de respuesta

1. **Consultas directas:** "Cuanto facture en febrero?" (datos crudos)
2. **Analisis cruzado:** "Que clientes compraban mensual y dejaron?" (razonamiento)
3. **Estrategia:** "A quien contacto esta semana y por que?" (recomendaciones)

## Decisiones de diseno

| Aspecto | Decision |
|---------|----------|
| Rol | Asesor experto que conoce todos los datos del negocio |
| Interfaz | Burbuja flotante (todas las paginas) + pagina /asesor (fullscreen) |
| Memoria | Dentro de la conversacion, se resetea al cerrar |
| Datos | Acceso completo: clientes, productos, ordenes, predicciones, metricas |
| Queries | Hibrido: ~15 predefinidas + SQL custom con restricciones |
| Costos | 20 preguntas/dia, Sonnet, 1000 max tokens/respuesta |
| Identidad | "PymePilot esta pensando...", "PymePilot esta consultando tus datos..." |
| Tono | Espanol argentino, directo, accionable, basado en datos reales |
| Prompt | Archivo separado: backend/config/prompts/asesor_chat.txt |

## Arquitectura

### Flujo de una pregunta

```
Vendedor pregunta
    |
    v
Frontend envia POST /api/chat { message, history }
    |
    v
Backend (Python) valida limite diario (chat_usage)
    |
    v
Claude API con tool use:
  - Tool 1: query_predefinida(nombre, params)  <- ~15 queries listas
  - Tool 2: query_custom(sql_select)           <- SQL libre con restricciones
    |
    v
Claude decide que tool usar, backend ejecuta query
    |
    v
Claude recibe resultados, arma respuesta natural
    |
    v
Frontend muestra respuesta + 2-3 sugerencias de seguimiento
```

### Prompt a Claude (por llamada)

1. System prompt (~500 tokens): personalidad, reglas, formato
2. Contexto del tenant (~100 tokens): nombre empresa, stats basicos
3. Tools disponibles: ~15 predefinidas + query custom
4. Historial de conversacion: mensajes previos de la sesion
5. Pregunta actual del vendedor

### Capas de seguridad

| Capa | Proteccion |
|------|-----------|
| 1. Tenant isolation | TODA query lleva WHERE tenant_id = $1 automatico |
| 2. Solo SELECT | Backend rechaza SQL que no sea SELECT |
| 3. Blacklist | Rechaza DROP, DELETE, INSERT, UPDATE, ALTER, TRUNCATE |
| 4. Sin sistema | Rechaza queries a pg_catalog, information_schema |
| 5. Timeout | Query custom: timeout 5 segundos |
| 6. RLS activo | PostgreSQL RLS como red de seguridad final |
| 7. Limite diario | Max 20 preguntas/dia (configurable CHAT_DAILY_LIMIT) |

## Queries predefinidas (~15)

| Tool | Pregunta que resuelve | Parametros |
|------|----------------------|------------|
| facturacion_periodo | Cuanto facture en [mes]? | periodo_inicio, periodo_fin |
| facturacion_cliente | Cuanto le vendi a [cliente]? | nombre_cliente, periodo |
| top_clientes | Quienes son mis mejores clientes? | criterio, top_n, periodo |
| clientes_inactivos | Quien no compra hace mas de X dias? | dias_inactividad |
| productos_mas_vendidos | Que productos se venden mas? | criterio, top_n, periodo |
| historial_cliente | Que compro [cliente] ultimamente? | nombre_cliente, ultimas_n |
| comparar_periodos | Comparame enero vs febrero | periodo_1, periodo_2 |
| clientes_nuevos | Cuantos clientes nuevos este mes? | periodo |
| ticket_promedio | Cual es el ticket promedio? | periodo, cliente |
| productos_cliente | Que productos le vendo a [cliente]? | nombre_cliente |
| clientes_por_producto | Quien compra [producto]? | nombre_producto |
| frecuencia_compra | Cada cuanto compra [cliente]? | nombre_cliente |
| predicciones_estado | Cuantas predicciones contacte? | periodo, estado |
| valor_atribuido | Cuanto valor generaron las predicciones? | periodo |
| resumen_negocio | Como viene el negocio? | periodo |

## Interfaz

### Burbuja flotante
- Boton circular esquina inferior derecha (todas las paginas)
- Panel ~400x500px superpuesto al contenido
- Header: "PymePilot" + cerrar + contador "18/20"
- Mobile: fullscreen
- Al cerrar: conversacion se pierde

### Pagina /asesor
- Entrada nueva en sidebar/bottom-nav
- Pantalla completa, mismo componente de chat
- Estado compartido con la burbuja (misma conversacion)

### Respuestas
- Texto plano, tablas, numeros destacados
- 2-3 sugerencias clickeables al final de cada respuesta
- Indicadores: "PymePilot esta pensando...", "PymePilot esta consultando tus datos..."
- Limite: "PymePilot alcanzo el limite de consultas de hoy"

## Control de costos

| Control | Valor |
|---------|-------|
| Preguntas por dia | 20 (env: CHAT_DAILY_LIMIT) |
| Max tokens/respuesta | 1,000 |
| Modelo | Claude Sonnet |
| Tracking | api_usage con usage_type='chat' |
| Costo estimado | ~$0.50-1.00/mes |

## Archivos nuevos

### Backend
- backend/engine/chat/handler.py — logica principal
- backend/engine/chat/tools.py — ~15 queries como tools
- backend/engine/chat/security.py — validacion SQL custom
- backend/config/prompts/asesor_chat.txt — system prompt

### Frontend
- frontend/src/components/chat/chat-bubble.tsx — burbuja flotante
- frontend/src/components/chat/chat-panel.tsx — panel reutilizable
- frontend/src/components/chat/chat-message.tsx — burbuja de mensaje
- frontend/src/components/chat/chat-input.tsx — input + enviar
- frontend/src/app/(dashboard)/asesor/page.tsx — pagina dedicada
- frontend/src/app/api/chat/route.ts — endpoint API

### Database
- database/migrations/040_chat_usage.sql — tabla limite diario

## Ejemplo de conversacion

> **Vendedor:** Como viene el negocio este mes?
>
> **PymePilot:** En marzo llevas $1.2M facturados en 8 dias, un 15%
> arriba de febrero al mismo corte. Tus 3 mejores clientes del mes son
> Distribuidora Norte ($180K), TechStore ($145K) y MagLife ($120K).
> Tenes 12 clientes que no compran hace mas de 30 dias — 3 de ellos
> eran recurrentes. Queres que te diga quienes son?
>
> **Vendedor:** Si, quienes son los 3 recurrentes que se cayeron
>
> **PymePilot:** Los 3 clientes recurrentes que dejaron de comprar son...
