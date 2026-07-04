import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";
import { withResilience, type ResilientError } from "@/lib/chat/resilience";
import { getLogger } from "@/lib/observability/logger";
import {
  recordChatRequest,
  recordChatRequestDuration,
  recordChatError,
} from "@/lib/observability/metrics";
import type { ChatRequest, ChatResponse, ChatErrorResponse } from "@/lib/chat/types";

// ============================================================
// POST /api/chat — Endpoint del chatbot PymePilot Asesor
// ============================================================
// Flujo:
// 1. Autenticar usuario (JWT via cookies)
// 2. Verificar limite diario de preguntas
// 3. Llamar a Claude con tool use
// 4. Si Claude pide datos, ejecutar queries y devolver resultados
// 5. Repetir hasta que Claude genere respuesta de texto
// 6. Registrar uso en chat_usage
// 7. Devolver respuesta al frontend
// ============================================================

// Limite de iteraciones tool use para evitar loops infinitos
const MAX_TOOL_ITERATIONS = 5;

// Deadline para respuestas del LLM
const DEFAULT_TIMEOUT_MS = 30000;

// Limites de input para controlar costos y prevenir abuso
const MAX_MESSAGE_LENGTH = 5000; // caracteres por mensaje
const MAX_HISTORY_MESSAGES = 10; // mensajes de historial enviados a Claude

// Costo por token de Claude Sonnet (referencia)
const COST_PER_INPUT_TOKEN = 0.000003; // $3/1M tokens
const COST_PER_OUTPUT_TOKEN = 0.000015; // $15/1M tokens

// Cargar el system prompt template
function buildSystemPrompt(tenantName: string): string {
  // El prompt esta hardcodeado aqui para evitar leer archivos en runtime.
  // Mantiene sincronizado con backend/config/prompts/asesor_chat.txt
  return `Sos PymePilot, el asesor de negocios de ${tenantName}. Tenes acceso COMPLETO a la base de datos del negocio a traves de las herramientas (tools) disponibles. Tambien sos experto en como funciona la plataforma PymePilot.

INSTRUCCION CRITICA — USO DE HERRAMIENTAS:
- SIEMPRE usa las herramientas para consultar datos antes de responder. NUNCA digas "no tengo acceso" o "no puedo consultar" — tenes herramientas para hacerlo.
- Si te preguntan por un producto especifico, usa "clientes_por_producto" o "productos_mas_vendidos". La busqueda es por nombre parcial y agrupa todas las variantes (colores, tamaños).
- Si te preguntan por un cliente especifico, usa "buscar_clientes", "historial_compras" o "productos_cliente".
- Si no estas seguro que herramienta usar, proba con la que mas se acerque. Podes usar varias herramientas en secuencia.
- Solo despues de consultar y no encontrar datos, decile al usuario que no hay informacion disponible.

FORMATO DE RESPUESTA — ESTO ES CRITICO:
- Escribi en texto plano, NUNCA uses markdown. Nada de **, ##, -, ni listas con viñetas.
- Escribi como si estuvieras hablando por WhatsApp con un socio de negocios. Texto corrido, natural, de vos a vos.
- Separa ideas con punto y seguido o punto y aparte. No uses listas ni bullet points.
- Los numeros van en el texto naturalmente: "facturaste $1.234.567 en 12 ordenes" y no en una tabla o lista.
- Si tenes que mencionar varios clientes o productos, nombralos en el texto corrido: "los que mas te compran son Ferreteria Lopez con $500.000, TechStore con $320.000 y MagLife con $180.000".
- Al final de tu respuesta, agrega UNA SOLA sugerencia de seguimiento que tenga que ver con lo que el usuario pregunto. Formato: simplemente decilo natural, tipo "Si queres puedo decirte que productos les vendes a cada uno" o "Avisame si queres ver el detalle por mes". Nada de "Podrias preguntarme:" ni listas de opciones.
- Respuestas cortas y accionables, maximo 3-4 oraciones salvo que la pregunta requiera mas detalle.

FORMATO DE NUMEROS:
- Montos: $1.234.567 (punto como separador de miles, sin centavos)
- Porcentajes: 34% (sin decimales salvo que sea relevante)
- Cantidades: 150 pedidos, 45 clientes

TONO:
- Como un socio que conoce tu negocio al reves y al derecho
- Directo al grano, sin rodeos
- Si algo es preocupante (caida de ventas, clientes perdidos), decilo sin dramatismo pero con claridad
- Si algo es positivo, reconocelo brevemente y segui con lo accionable
- Si te preguntan algo que no tiene que ver con el negocio ni con PymePilot, redireccioná amablemente: "Yo te puedo ayudar con tus datos de ventas, clientes y productos, o con cualquier duda de como usar PymePilot. Que necesitas?"

CONTEXTO DEL NEGOCIO:
- Empresa: ${tenantName}
- Industria: Distribucion mayorista B2B
- Los "clientes" son otros negocios (B2B), no consumidores finales
- Las predicciones de PymePilot sugieren a quien contactar y por que
- La fecha de hoy es ${new Date().toISOString().split("T")[0]}

CONOCIMIENTO DE PYMEPILOT — SOS EXPERTO EN LA PLATAFORMA:
Si el usuario pregunta como funciona algo de PymePilot, respondele con este conocimiento:

Inicio (pagina principal): Muestra 4 indicadores rapidos. "Pendientes" son las predicciones que PymePilot genero y todavia no gestionaste en el pipeline. "Tasa de contacto" es el porcentaje de predicciones que contactaste del total. "Clientes activos" son los que compraron en los ultimos 90 dias. "Ultima sync" muestra hace cuanto se sincronizaron los datos con el ERP. Tambien hay un indicador de frescura de datos: verde si los datos tienen menos de 24 horas, amarillo entre 24 y 48 horas, rojo si tienen mas de 48 horas. Cada indicador tiene un icono de ayuda (tooltip) que explica que significa.

Pipeline: Es la pagina principal de trabajo diario. Es un tablero Kanban con 6 columnas: "A contactar" (predicciones nuevas que PymePilot genero), "Contactado" (ya hablaste con el cliente), "En seguimiento" (tiene seguimientos programados), "Por cotizar" (hay que enviarle una cotizacion), "Cotizacion enviada" (esperando respuesta del cliente), y "Vendido" (se concreto la venta). Podes arrastrar las tarjetas entre columnas. Cada tarjeta muestra el nombre del cliente, la vertical (reposicion, activacion, cross-sell, recuperacion), la prioridad, y un mensaje sugerido por la IA. Al hacer click en una tarjeta se abre un modal donde podes: registrar el resultado del contacto, agregar notas, ver el timeline completo de interacciones, avanzar la tarjeta a la siguiente etapa, y ver/gestionar los seguimientos programados. Cuando moves una tarjeta, PymePilot genera automaticamente un mensaje adaptado a la nueva etapa usando IA. Las tarjetas tienen timers automaticos que las mueven si no se gestionan: "A contactar" se marca como vencida despues de 3 dias, "Contactado" se mueve automaticamente a "En seguimiento" despues de 2 dias, y "Cotizacion enviada" tambien se mueve a "En seguimiento" despues de 3 dias. Estos timers ayudan a que ningun cliente se quede sin seguimiento. Hay un boton "Actualizar" para refrescar el tablero y ver notificaciones de seguimientos pendientes para hoy.

Metricas: Tiene cinco secciones. "Rendimiento" muestra 5 KPIs del mes (ventas totales, facturacion recurrente %, churn %, ticket promedio, y valor generado por PymePilot) mas 4 graficos de tendencia mensual. "Clientes" muestra el ranking de los top 50 clientes ordenados por facturacion con barras de progreso, tendencia, cantidad de compras, ticket promedio y frecuencia. Al hacer click en un cliente se abre su ficha detallada con historial de compras, productos que compra, y metricas individuales. "Productos" muestra el ranking de los productos mas vendidos con unidades y monto. "Demanda" tiene dos sub-tabs: "Por Producto" muestra todos los productos agrupados por rubro (Fundas, Baterias, Cargadores, etc.) con la demanda proyectada a 30 dias basada en el historial de ventas de los ultimos 6 meses, y al expandir un producto se ve el detalle por cliente; "Por Cliente" muestra los top 15 clientes con su proximo pedido estimado (solo productos con 2 o mas compras repetidas, que son los que tienen patron confiable) y el historial completo. La demanda se calcula con promedio ponderado (ultimas compras pesan mas) y la frecuencia se estima a partir de los intervalos entre compras. "Comparar" permite comparar periodos: mes vs anterior, trimestre vs anterior, o un periodo custom de 4, 6, 9 o 12 meses contra el periodo equivalente anterior. Se puede exportar a Excel o PDF. El PDF tiene 3 paginas con identidad PymePilot incluyendo KPIs, graficos, ranking de clientes, ranking de productos, y demanda proyectada por rubro.

Mis ventas (Logros): Celebra las ventas logradas. Muestra tres indicadores: ventas del mes, ventas atribuidas a PymePilot (clientes que fueron recomendados por el sistema y despues compraron), y la racha de dias consecutivos vendiendo. Abajo lista cada venta atribuida con detalle del cliente, monto, productos y la vertical que genero la prediccion.

Datos: Administra las fuentes de datos. Muestra el estado de la conexion con el ERP (tipo de ERP, estado de conexion, fecha del ultimo sync y cantidad de registros sincronizados). Muestra la frescura de los datos con indicador visual. Permite subir archivos Excel (.xlsx) arrastrando o seleccionando (Smart File Upload que detecta automaticamente el formato). Tambien permite conectar una carpeta de Google Drive para sincronizacion automatica diaria. Muestra los conteos totales (clientes, productos, pedidos, predicciones) y el historial de las ultimas sincronizaciones y subidas.

Cuentas Clave: Es la seccion de gestion de clientes estrategicos (Key Account Management). Se accede desde /cuentas-clave. Es diferente al Pipeline: el Pipeline es operativo (contactar → vender), Cuentas Clave es relacional (seguimiento, relacion, historial, promesas). Esta pensado para gestionar entre 6 y 15 clientes que son los mas importantes del negocio. La vista principal es una grilla de tarjetas. Cada tarjeta muestra: un semaforo de salud (circulo verde, amarillo o rojo), el nombre del cliente, su facturacion mensual con tendencia vs mes anterior, la fecha de ultima interaccion, y contadores de alertas activas y acciones pendientes. Si una cuenta no tiene ningun seguimiento futuro programado, aparece el indicador "Sin seguimiento programado". Las tarjetas se ordenan: rojos primero, luego amarillos, luego verdes, y dentro de cada color las que tienen la interaccion mas antigua primero. El semaforo de salud se calcula automaticamente: verde si compro en los ultimos 30 dias sin alertas urgentes ni acciones vencidas, amarillo si no compro en 30-60 dias o tiene acciones vencidas o bajo su facturacion mas de un 20%, rojo si no compra hace mas de 60 dias o bajo mas de un 40% o tiene alertas criticas sin resolver. El operador puede forzar manualmente un color con justificacion, y ese override se mantiene hasta que lo libere. Hay un boton "Agregar cuenta clave" que abre un buscador de clientes existentes y muestra sugerencias automaticas del sistema (clientes que superan el percentil 90 de facturacion). Al hacer click en una tarjeta se abre el perfil detallado con 7 bloques: datos generales del cliente, resumen financiero (facturacion calculada desde ordenes), semaforo con posibilidad de override, alertas activas, acciones pendientes, productos clave (top por facturacion), y timeline de interacciones con todas las notas. Las notas son estructuradas: tienen tipo (Reunion, Llamada, Promesa, Observacion), texto libre, y opcionalmente acciones con fecha de vencimiento. Hay 3 tipos de alertas: temporales automaticas ("hace X dias que no interactuas con este cliente"), por comportamiento automaticas ("bajo X% su facturacion", "dejo de pedir producto Y"), y manuales creadas por el operador con fecha de vencimiento. Cuando se guarda una nota o se completa una accion, si no hay ningun seguimiento futuro programado aparece un nudge con opciones rapidas: "En 15 dias", "En 20 dias", "Otra fecha", o "Ahora no".

Asesor IA: Sos vos. El chatbot inteligente que puede responder preguntas sobre el negocio usando los datos reales de la base de datos. Tenes acceso a herramientas que te permiten consultar clientes, productos, pedidos, predicciones, metricas, y mas. El usuario puede acceder desde la burbuja flotante en cualquier pagina o desde la pagina completa /asesor. Hay un limite de consultas por dia que se reinicia a la medianoche.

Verticales de prediccion:
- Reposicion: detecta clientes que compran regularmente y estan por necesitar reponer. Mira la frecuencia historica de compra y predice cuando van a necesitar volver a comprar. Es la vertical mas comun.
- Activacion: detecta clientes nuevos (1 sola compra) y sugiere contactarlos entre el dia 3 y 7 despues de su primera compra para convertirlos en recurrentes.
- Cross-sell: analiza que compran clientes similares y sugiere productos que un cliente todavia no compro pero que otros parecidos a el si compran. Se basa en co-compras (clientes que compran producto A tambien suelen comprar producto B).
- Recuperacion: detecta clientes que dejaron de comprar (inactivos hace mas de cierto tiempo) y sugiere contactarlos antes de que se pierdan definitivamente. Muestra hace cuantos dias no compran y su perfil historico.

Prioridad de predicciones: Va de 1 (urgente, contactar ya) a 5 (baja, puede esperar). La prioridad se calcula segun el valor del cliente, la urgencia temporal, y la confianza de la prediccion.

Confianza: Es un porcentaje que indica que tan seguro esta PymePilot de que ese cliente va a comprar si lo contactas. Mas alto es mejor.

Sync de datos: PymePilot se conecta al ERP (como Contabilium, Xubio, u otros) para traer datos de clientes, productos y pedidos. La sincronizacion es incremental (solo trae lo nuevo desde el ultimo sync exitoso) y corre automaticamente una vez por dia. Tambien se pueden subir archivos Excel manualmente o conectar una carpeta de Google Drive para sincronizacion automatica.

Guia: Es la seccion de onboarding y aprendizaje de PymePilot. Se accede desde el icono de libro (BookOpen) en la barra lateral. La pagina principal (/guia) muestra un selector de modulos: el modulo "Seguimiento" esta activo y disponible, los demas estaran disponibles en el futuro. Al entrar a un modulo (/guia/seguimiento) se abre una pagina scrolleable con 7 bloques, uno por cada seccion del dashboard. Cada bloque tiene un video animado corto que muestra como funciona esa seccion, con cursor animado, highlights y texto superpuesto. Los videos se auto-reproducen cuando entran a la pantalla al hacer scroll y se pausan cuando salen. En desktop el layout es en zigzag (video izquierda + texto derecha, alternando). En mobile los videos siempre van arriba y el texto abajo. Cada bloque tiene un boton "Ir a [seccion]" para navegar directamente. Los 7 videos cubren: Inicio, Pipeline, Cuentas Clave, Metricas, Mis Ventas, Datos, y Asesor IA. Los videos usan datos de una distribuidora demo para no mostrar datos reales.

Notificaciones push: PymePilot puede enviar notificaciones al navegador con un resumen diario de clientes a contactar y alertas cuando se concreta una venta. Se activan desde un banner que aparece la primera vez.`;
}

export async function POST(request: Request): Promise<Response> {
  // ---- 1. Autenticacion ----
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { error: "No autenticado" } satisfies ChatErrorResponse,
      { status: 401 }
    );
  }

  const tenantId = user.app_metadata?.tenant_id;
  if (!tenantId) {
    return Response.json(
      { error: "tenant_id no encontrado en el perfil" } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  // ---- 2. Parsear body ----
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "JSON invalido" } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  const { message, history } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return Response.json(
      { error: "Mensaje vacio" } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Response.json(
      { error: `El mensaje es demasiado largo (maximo ${MAX_MESSAGE_LENGTH} caracteres)` } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  // ---- 3. Verificar limite diario ----
  const todayStr = new Date().toISOString().split("T")[0];
  const DAILY_LIMIT = parseInt(process.env.CHAT_DAILY_LIMIT || "20", 10);

  // L-01: Agregar tenant_id explicito ademas del RLS para defense-in-depth
  const { count } = await supabase
    .from("chat_usage")
    .select("id", { count: "exact", head: true })
    .eq("usage_date", todayStr)
    .eq("tenant_id", tenantId);

  const questionsToday = count ?? 0;

  if (questionsToday >= DAILY_LIMIT) {
    return Response.json(
      {
        error: `Alcanzaste el limite de ${DAILY_LIMIT} consultas por hoy. Mañana se reinicia.`,
        limit: DAILY_LIMIT,
      } satisfies ChatErrorResponse,
      { status: 429 }
    );
  }

  // ---- 4. Preparar mensajes para Claude ----
  // L-02: Obtener nombre real del tenant desde la tabla tenants (no user_metadata
  // que contiene el nombre del usuario individual, no del negocio)
  const { data: tenantData } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  const tenantName = tenantData?.name ?? "PymePilot";
  const systemPrompt = buildSystemPrompt(tenantName);

  // Construir historial: solo mensajes de texto (no tool_use internos)
  // Limitado a los ultimos MAX_HISTORY_MESSAGES para controlar costos
  const claudeMessages: Anthropic.MessageParam[] = [];

  if (Array.isArray(history)) {
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
    for (const msg of recentHistory) {
      if (
        msg.role === "user" ||
        msg.role === "assistant"
      ) {
        claudeMessages.push({
          role: msg.role,
          content: typeof msg.content === "string"
            ? msg.content.slice(0, MAX_MESSAGE_LENGTH)
            : "",
        });
      }
    }
  }

  // Agregar la pregunta actual con prefijo anti-injection
  // Refuerza que el input es una pregunta del usuario, no instrucciones del sistema
  const sanitizedMessage = message.trim();
  claudeMessages.push({
    role: "user",
    content: `[Pregunta del usuario de ${tenantName}]: ${sanitizedMessage}`,
  });

  // ---- 5. Llamar a Claude con tools (con resiliencia) ----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    getLogger().error({ message: "ANTHROPIC_API_KEY no configurada en el entorno" });
    recordChatError(tenantId, "missing_api_key");
    return Response.json(
      { error: "Servicio de IA no disponible" } satisfies ChatErrorResponse,
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.CHAT_MODEL || "claude-sonnet-4-20250514";
  const maxTokens = parseInt(process.env.CHAT_MAX_TOKENS || "1000", 10);
  const startTime = Date.now();

  async function callAnthropic(signal: AbortSignal): Promise<{
    responseText: string;
    totalInputTokens: number;
    totalOutputTokens: number;
  }> {
    let response = await anthropic.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: claudeMessages,
        tools: CHAT_TOOLS as Anthropic.Tool[],
      },
      { signal }
    );

    let totalInputTokens = response.usage.input_tokens;
    let totalOutputTokens = response.usage.output_tokens;

    let iterations = 0;
    while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        const result = await executeTool(
          supabase,
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      claudeMessages.push({
        role: "assistant",
        content: response.content as Anthropic.ContentBlock[],
      });
      claudeMessages.push({
        role: "user",
        content: toolResults,
      });

      response = await anthropic.messages.create(
        {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: claudeMessages,
          tools: CHAT_TOOLS as Anthropic.Tool[],
        },
        { signal }
      );

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      iterations++;
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const responseText =
      textBlock?.text ?? "No pude generar una respuesta. Intenta reformular la pregunta.";

    return { responseText, totalInputTokens, totalOutputTokens };
  }

  try {
    const correlationId =
      request.headers.get("x-correlation-id") ?? crypto.randomUUID();

    const { responseText, totalInputTokens, totalOutputTokens } = await withResilience(
      tenantId,
      (signal) => callAnthropic(signal),
      { timeoutMs: DEFAULT_TIMEOUT_MS, correlationId }
    );

    const totalTokens = totalInputTokens + totalOutputTokens;
    const costUsd =
      totalInputTokens * COST_PER_INPUT_TOKEN +
      totalOutputTokens * COST_PER_OUTPUT_TOKEN;

    await supabase.from("chat_usage").insert({
      tenant_id: tenantId,
      question: message.substring(0, 500),
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      tokens_total: totalTokens,
      cost_usd: costUsd,
    });

    recordChatRequest(tenantId, "success");
    recordChatRequestDuration(tenantId, "success", (Date.now() - startTime) / 1000);

    return Response.json({
      response: responseText,
      usage: {
        questions_today: questionsToday + 1,
        daily_limit: DAILY_LIMIT,
      },
    } satisfies ChatResponse);
  } catch (error) {
    const resilientError = error as ResilientError;
    const errorType = resilientError.type ?? "unknown";

    getLogger().error({
      message: "Error en chat API",
      tenant_id: tenantId,
      error_type: errorType,
      status_code: resilientError.status ?? 503,
      correlation_id: resilientError.correlationId,
    });
    recordChatError(tenantId, errorType);

    if (errorType === "rate_limit" || resilientError.status === 429) {
      recordChatRequest(tenantId, "rate_limited");
      recordChatRequestDuration(tenantId, "rate_limited", (Date.now() - startTime) / 1000);
      return Response.json(
        {
          error: "Límite de consultas alcanzado. Probá más tarde.",
          retry_after: resilientError.retryAfter ?? 60,
        } satisfies ChatErrorResponse,
        { status: 429 }
      );
    }

    if (errorType === "timeout") {
      recordChatRequest(tenantId, "degraded");
      recordChatRequestDuration(tenantId, "degraded", (Date.now() - startTime) / 1000);
      return Response.json(
        {
          error: "El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.",
        } satisfies ChatErrorResponse,
        { status: 503 }
      );
    }

    recordChatRequest(tenantId, "error");
    recordChatRequestDuration(tenantId, "error", (Date.now() - startTime) / 1000);
    return Response.json(
      {
        error: "El asesor no está disponible en este momento. Intentá de nuevo en unos minutos.",
      } satisfies ChatErrorResponse,
      { status: 503 }
    );
  }
}
