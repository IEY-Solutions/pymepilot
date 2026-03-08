import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";
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

Inicio (pagina principal): Muestra 4 indicadores rapidos. "Pendientes" son las predicciones que PymePilot genero y todavia no contactaste. "Tasa de contacto" es el porcentaje de predicciones que contactaste del total. "Clientes activos" son los que compraron en los ultimos 90 dias. "Ultima sync" muestra hace cuanto se sincronizaron los datos con el ERP. Tambien hay un indicador de frescura de datos: verde si los datos tienen menos de 24 horas, amarillo entre 24 y 48 horas, rojo si tienen mas de 48 horas.

Contactar: Es la pagina principal de trabajo diario. Muestra las predicciones de hoy, o sea, los clientes que PymePilot recomienda contactar. Cada tarjeta tiene el nombre del cliente, la prioridad (1 urgente a 5 baja), el tipo de prediccion (reposicion, activacion, cross-sell, recuperacion), el puntaje de confianza, telefono, email, ultima compra, y un mensaje sugerido listo para copiar y mandar por WhatsApp. Podes filtrar por tipo de prediccion y ordenar por urgencia, importancia del cliente, monto potencial, o mas recientes. Cuando contactas a alguien, lo marcas como "contactado" y despues como "completado" si compro.

Metricas: Tiene dos pestañas. "Rendimiento" muestra 5 KPIs del mes (ventas totales, porcentaje de facturacion recurrente, churn, ticket promedio, y valor generado por PymePilot) mas 4 graficos de tendencia mensual (facturacion, churn, ticket, valor PymePilot). "Clientes" muestra el ranking de clientes ordenados por facturacion, con tendencia, cantidad de compras, ticket promedio, ultima compra y frecuencia. Se puede exportar a Excel o PDF.

Historial: Registro completo de todas las predicciones generadas. Se puede buscar por cliente y filtrar por estado (pendiente, contactado, ignorado, completado, expirado). Tiene paginacion de 50 por pagina.

Mis ventas (Logros): Celebra las ventas logradas. Muestra ventas del mes, ventas atribuidas a PymePilot (clientes que fueron recomendados y compraron), y la racha de dias consecutivos vendiendo. Abajo lista cada venta atribuida con detalle de productos.

Datos: Administra las fuentes de datos. Muestra el estado de la conexion con el ERP (Contabilium), la frescura de los datos, y permite subir archivos Excel manualmente o conectar Google Drive. Tambien muestra los conteos totales (clientes, productos, pedidos, predicciones) y el historial de las ultimas sincronizaciones y subidas.

Asesor IA: Sos vos. El chatbot que puede responder preguntas sobre el negocio usando los datos reales de la base de datos.

Verticales de prediccion:
- Reposicion: detecta clientes que compran regularmente y estan por necesitar reponer. Mira la frecuencia historica de compra y predice cuando van a necesitar volver a comprar.
- Activacion: detecta clientes nuevos (1 sola compra) y sugiere contactarlos entre el dia 3 y 7 despues de su primera compra para convertirlos en recurrentes.
- Cross-sell: analiza que compran clientes similares y sugiere productos que un cliente todavia no compro pero que otros como el si compran.
- Recuperacion: detecta clientes que dejaron de comprar (inactivos) y sugiere contactarlos antes de que se pierdan. Muestra hace cuantos dias no compran.

Prioridad de predicciones: Va de 1 (urgente, contactar ya) a 5 (baja, puede esperar). La prioridad se calcula segun el valor del cliente, la urgencia temporal, y la confianza de la prediccion.

Confianza: Es un porcentaje que indica que tan seguro esta PymePilot de que ese cliente va a comprar si lo contactas. Mas alto es mejor.

Sync de datos: PymePilot se conecta al ERP (Contabilium) para traer datos de clientes, productos y pedidos. La sincronizacion es incremental (solo trae lo nuevo) y corre automaticamente. Tambien se pueden subir archivos Excel o conectar una carpeta de Google Drive.`;
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

  // ---- 3. Verificar limite diario ----
  const todayStr = new Date().toISOString().split("T")[0];
  const DAILY_LIMIT = parseInt(process.env.CHAT_DAILY_LIMIT || "20", 10);

  const { count } = await supabase
    .from("chat_usage")
    .select("id", { count: "exact", head: true })
    .eq("usage_date", todayStr);

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
  const tenantName = user.user_metadata?.full_name ?? "PymePilot";
  const systemPrompt = buildSystemPrompt(tenantName);

  // Construir historial: solo mensajes de texto (no tool_use internos)
  const claudeMessages: Anthropic.MessageParam[] = [];

  if (Array.isArray(history)) {
    for (const msg of history) {
      if (
        msg.role === "user" ||
        msg.role === "assistant"
      ) {
        claudeMessages.push({
          role: msg.role,
          content: typeof msg.content === "string" ? msg.content : "",
        });
      }
    }
  }

  // Agregar la pregunta actual
  claudeMessages.push({ role: "user", content: message.trim() });

  // ---- 5. Llamar a Claude con tools ----
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY no configurada en el entorno");
    return Response.json(
      { error: "Servicio de IA no disponible" } satisfies ChatErrorResponse,
      { status: 503 }
    );
  }

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.CHAT_MODEL || "claude-sonnet-4-20250514";
  const maxTokens = parseInt(process.env.CHAT_MAX_TOKENS || "1000", 10);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    let response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: claudeMessages,
      tools: CHAT_TOOLS as Anthropic.Tool[],
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // ---- 6. Loop de tool use ----
    // Claude puede pedir datos multiples veces antes de responder.
    // Limitamos a MAX_TOOL_ITERATIONS para evitar loops infinitos.
    let iterations = 0;

    while (response.stop_reason === "tool_use" && iterations < MAX_TOOL_ITERATIONS) {
      // Encontrar todos los tool_use blocks en la respuesta
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      // Ejecutar cada tool y armar los resultados
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

      // Agregar la respuesta de Claude (con tool_use) y nuestros resultados
      claudeMessages.push({
        role: "assistant",
        content: response.content as Anthropic.ContentBlock[],
      });
      claudeMessages.push({
        role: "user",
        content: toolResults,
      });

      // Siguiente llamada a Claude con los resultados
      response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: claudeMessages,
        tools: CHAT_TOOLS as Anthropic.Tool[],
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      iterations++;
    }

    // ---- 7. Extraer respuesta de texto ----
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const responseText =
      textBlock?.text ?? "No pude generar una respuesta. Intenta reformular la pregunta.";

    // ---- 8. Registrar uso en chat_usage ----
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

    // ---- 9. Retornar respuesta ----
    return Response.json({
      response: responseText,
      usage: {
        questions_today: questionsToday + 1,
        daily_limit: DAILY_LIMIT,
      },
    } satisfies ChatResponse);
  } catch (error) {
    console.error("Error en chat API:", error);

    // Manejar errores especificos de Anthropic
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return Response.json(
          { error: "El servicio de IA esta temporalmente sobrecargado. Intenta en unos minutos." } satisfies ChatErrorResponse,
          { status: 429 }
        );
      }
      return Response.json(
        { error: "Error al comunicarse con el servicio de IA" } satisfies ChatErrorResponse,
        { status: 502 }
      );
    }

    return Response.json(
      { error: "Error interno del servidor" } satisfies ChatErrorResponse,
      { status: 500 }
    );
  }
}
