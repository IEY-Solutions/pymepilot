import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Definiciones de tools para Claude (Anthropic Tool Use API)
// ============================================================
// Cada tool tiene:
// 1. Definicion JSON Schema (lo que Claude ve)
// 2. Funcion de ejecucion (lo que el servidor hace)
//
// Concepto: "Tool Use" permite que Claude pida datos al servidor.
// Claude analiza la pregunta del usuario, decide que datos necesita,
// y llama a la tool correspondiente. El servidor ejecuta la query,
// le devuelve los resultados, y Claude arma una respuesta natural.
// ============================================================

// Tipo para las definiciones de tools de Anthropic
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================
// 1. DEFINICIONES DE TOOLS (lo que Claude ve)
// ============================================================

export const CHAT_TOOLS: AnthropicTool[] = [
  {
    name: "buscar_clientes",
    description:
      "Buscar clientes por nombre, estado o inactividad. Devuelve nombre, email, telefono, total compras, ultima compra, estado. Usar para: quien es [cliente], clientes inactivos, buscar un cliente.",
    input_schema: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre parcial del cliente (busqueda flexible)",
        },
        estado: {
          type: "string",
          enum: ["active", "inactive", "new", "lost"],
          description: "Filtrar por estado",
        },
        dias_inactividad: {
          type: "number",
          description: "Clientes que no compran hace mas de N dias",
        },
        limite: {
          type: "number",
          description: "Cantidad maxima de resultados (default 20)",
        },
      },
    },
  },
  {
    name: "facturacion",
    description:
      "Obtener total facturado en un periodo, opcionalmente filtrado por cliente. Devuelve total, cantidad de ordenes, y ticket promedio. Usar para: cuanto facture, ventas del mes, cuanto le vendi a [cliente].",
    input_schema: {
      type: "object",
      properties: {
        fecha_inicio: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD",
        },
        fecha_fin: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD",
        },
        nombre_cliente: {
          type: "string",
          description: "Nombre parcial del cliente para filtrar",
        },
      },
      required: ["fecha_inicio", "fecha_fin"],
    },
  },
  {
    name: "top_clientes",
    description:
      "Ranking de mejores clientes por facturacion total. Devuelve nombre, total ordenes, total facturado, ticket promedio, ultima compra. Usar para: mejores clientes, quienes son mis mejores clientes.",
    input_schema: {
      type: "object",
      properties: {
        limite: {
          type: "number",
          description: "Cantidad de clientes a mostrar (default 10)",
        },
      },
    },
  },
  {
    name: "historial_compras",
    description:
      "Ver las ultimas compras de un cliente con detalle de productos. Usar para: que compro [cliente], ultimo pedido de [cliente], historial de [cliente].",
    input_schema: {
      type: "object",
      properties: {
        nombre_cliente: {
          type: "string",
          description: "Nombre parcial del cliente",
        },
        ultimas_n: {
          type: "number",
          description: "Cantidad de ordenes a mostrar (default 5)",
        },
      },
      required: ["nombre_cliente"],
    },
  },
  {
    name: "productos_mas_vendidos",
    description:
      "Top productos por cantidad vendida o facturacion. Usar para: que se vende mas, productos estrella, ranking de productos.",
    input_schema: {
      type: "object",
      properties: {
        limite: {
          type: "number",
          description: "Cantidad de productos (default 10)",
        },
        fecha_inicio: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD (opcional)",
        },
        fecha_fin: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD (opcional)",
        },
      },
    },
  },
  {
    name: "productos_cliente",
    description:
      "Top productos que compra un cliente especifico. Devuelve producto, cantidad total, facturacion total, veces ordenado. Usar para: que le vendo a [cliente], productos de [cliente].",
    input_schema: {
      type: "object",
      properties: {
        nombre_cliente: {
          type: "string",
          description: "Nombre parcial del cliente",
        },
        limite: {
          type: "number",
          description: "Cantidad de productos (default 5)",
        },
      },
      required: ["nombre_cliente"],
    },
  },
  {
    name: "clientes_por_producto",
    description:
      "Que clientes compran un producto o familia de productos. Busca por nombre parcial y SUMA todas las variantes (colores, tamaños). Incluye las variantes encontradas en la respuesta. Usar para: quien compra [producto], clientes de [producto], top compradores de [producto].",
    input_schema: {
      type: "object",
      properties: {
        nombre_producto: {
          type: "string",
          description: "Nombre parcial del producto",
        },
        limite: {
          type: "number",
          description: "Cantidad de clientes (default 10)",
        },
      },
      required: ["nombre_producto"],
    },
  },
  {
    name: "clientes_nuevos",
    description:
      "Clientes que hicieron su primera compra en un periodo. Usar para: clientes nuevos del mes, cuantos clientes nuevos.",
    input_schema: {
      type: "object",
      properties: {
        fecha_inicio: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD",
        },
        fecha_fin: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD",
        },
      },
      required: ["fecha_inicio", "fecha_fin"],
    },
  },
  {
    name: "predicciones",
    description:
      "Estado de las predicciones de PymePilot. Cuantas pendientes, contactadas, completadas. Usar para: cuantas predicciones tengo, cuantas contacte, estado de predicciones.",
    input_schema: {
      type: "object",
      properties: {
        estado: {
          type: "string",
          enum: ["pending", "contacted", "completed", "ignored", "expired"],
          description: "Filtrar por estado",
        },
        vertical: {
          type: "string",
          enum: ["reposicion", "activacion", "cross_sell", "recuperacion"],
          description: "Filtrar por vertical",
        },
        fecha_inicio: {
          type: "string",
          description: "Fecha inicio YYYY-MM-DD (opcional)",
        },
        fecha_fin: {
          type: "string",
          description: "Fecha fin YYYY-MM-DD (opcional)",
        },
      },
    },
  },
  {
    name: "valor_pymepilot",
    description:
      "Valor monetario generado por las predicciones de PymePilot. Cuantas predicciones se convirtieron en ventas y por cuanto. Usar para: cuanto genero PymePilot, valor de las predicciones.",
    input_schema: {
      type: "object",
      properties: {
        meses: {
          type: "number",
          description: "Cantidad de meses hacia atras (default 6)",
        },
      },
    },
  },
  {
    name: "tendencia_mensual",
    description:
      "Tendencia de facturacion mensual con desglose recurrente vs nueva. Usar para: como vienen las ventas, tendencia, comparar meses.",
    input_schema: {
      type: "object",
      properties: {
        meses: {
          type: "number",
          description: "Cantidad de meses hacia atras (default 6)",
        },
      },
    },
  },
  {
    name: "churn_mensual",
    description:
      "Tasa de churn (perdida de clientes) mensual. Cuantos clientes dejaron de comprar cada mes. Usar para: cuantos clientes perdi, churn, retencion.",
    input_schema: {
      type: "object",
      properties: {
        meses: {
          type: "number",
          description: "Cantidad de meses hacia atras (default 6)",
        },
      },
    },
  },
  {
    name: "resumen_negocio",
    description:
      "Resumen general del negocio: total clientes, facturacion del mes, predicciones activas, ticket promedio. Usar para: como viene el negocio, resumen, dashboard.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================
// 2. FUNCIONES DE EJECUCION (lo que el servidor hace)
// ============================================================

// Tipo generico para los inputs de tools
type ToolInput = Record<string, unknown>;

// Ejecuta un tool y devuelve el resultado como string para Claude
export async function executeTool(
  supabase: SupabaseClient,
  toolName: string,
  input: ToolInput
): Promise<string> {
  try {
    switch (toolName) {
      case "buscar_clientes":
        return await execBuscarClientes(supabase, input);
      case "facturacion":
        return await execFacturacion(supabase, input);
      case "top_clientes":
        return await execTopClientes(supabase, input);
      case "historial_compras":
        return await execHistorialCompras(supabase, input);
      case "productos_mas_vendidos":
        return await execProductosMasVendidos(supabase, input);
      case "productos_cliente":
        return await execProductosCliente(supabase, input);
      case "clientes_por_producto":
        return await execClientesPorProducto(supabase, input);
      case "clientes_nuevos":
        return await execClientesNuevos(supabase, input);
      case "predicciones":
        return await execPredicciones(supabase, input);
      case "valor_pymepilot":
        return await execValorPymepilot(supabase, input);
      case "tendencia_mensual":
        return await execTendenciaMensual(supabase, input);
      case "churn_mensual":
        return await execChurnMensual(supabase, input);
      case "resumen_negocio":
        return await execResumenNegocio(supabase);
      default:
        return `Error: tool "${toolName}" no existe.`;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return `Error ejecutando ${toolName}: ${msg}`;
  }
}

// ============================================================
// Helpers
// ============================================================

// Busca un customer_id por nombre parcial (ILIKE). Retorna el primero.
async function findCustomerByName(
  supabase: SupabaseClient,
  nombre: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("name", `%${nombre}%`)
    .limit(1)
    .single();
  return data;
}

function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString("es-AR")}`;
}

// ============================================================
// Tool: buscar_clientes
// ============================================================

async function execBuscarClientes(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const nombre = input.nombre as string | undefined;
  const estado = input.estado as string | undefined;
  const diasInactividad = input.dias_inactividad as number | undefined;
  const limite = (input.limite as number) || 20;

  let query = supabase
    .from("customers")
    .select(
      "name, email, phone, status, total_purchases_count, total_purchases_amount, last_purchase_date, first_purchase_date, avg_days_between_purchases"
    )
    .order("total_purchases_amount", { ascending: false })
    .limit(limite);

  if (nombre) {
    query = query.ilike("name", `%${nombre}%`);
  }
  if (estado) {
    query = query.eq("status", estado);
  }
  if (diasInactividad) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - diasInactividad);
    query = query.lt("last_purchase_date", cutoff.toISOString().split("T")[0]);
  }

  const { data, error } = await query;
  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No se encontraron clientes con esos criterios.";

  return JSON.stringify(
    data.map((c) => ({
      nombre: c.name,
      email: c.email,
      telefono: c.phone,
      estado: c.status,
      total_pedidos: c.total_purchases_count,
      total_facturado: c.total_purchases_amount,
      ultima_compra: c.last_purchase_date,
      primera_compra: c.first_purchase_date,
      dias_promedio_entre_compras: c.avg_days_between_purchases,
    }))
  );
}

// ============================================================
// Tool: facturacion
// ============================================================

async function execFacturacion(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const fechaInicio = input.fecha_inicio as string;
  const fechaFin = input.fecha_fin as string;
  const nombreCliente = input.nombre_cliente as string | undefined;

  let query = supabase
    .from("orders")
    .select("total_amount, order_date, customer_id, customers(name)")
    .eq("status", "completed")
    .gte("order_date", fechaInicio)
    .lte("order_date", fechaFin);

  // Si se filtro por cliente, buscar el customer_id primero
  if (nombreCliente) {
    const customer = await findCustomerByName(supabase, nombreCliente);
    if (!customer) return `No se encontro un cliente con nombre "${nombreCliente}".`;
    query = query.eq("customer_id", customer.id);
  }

  const { data, error } = await query;
  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0)
    return `No hay ordenes completadas entre ${fechaInicio} y ${fechaFin}.`;

  const total = data.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const count = data.length;
  const avgTicket = count > 0 ? total / count : 0;

  const result: Record<string, unknown> = {
    periodo: `${fechaInicio} a ${fechaFin}`,
    total_facturado: formatCurrency(total),
    cantidad_ordenes: count,
    ticket_promedio: formatCurrency(avgTicket),
  };

  if (nombreCliente) {
    result.cliente = nombreCliente;
  }

  return JSON.stringify(result);
}

// ============================================================
// Tool: top_clientes
// ============================================================

async function execTopClientes(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const limite = (input.limite as number) || 10;

  const { data, error } = await supabase
    .from("client_rankings_secure")
    .select("name, total_orders, total_revenue, avg_ticket, last_purchase, ranking")
    .order("ranking", { ascending: true })
    .limit(limite);

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay datos de ranking de clientes.";

  return JSON.stringify(
    data.map((c) => ({
      ranking: c.ranking,
      nombre: c.name,
      total_pedidos: c.total_orders,
      total_facturado: formatCurrency(Number(c.total_revenue)),
      ticket_promedio: formatCurrency(Number(c.avg_ticket)),
      ultima_compra: c.last_purchase,
    }))
  );
}

// ============================================================
// Tool: historial_compras
// ============================================================

async function execHistorialCompras(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const nombreCliente = input.nombre_cliente as string;
  const ultimasN = (input.ultimas_n as number) || 5;

  const customer = await findCustomerByName(supabase, nombreCliente);
  if (!customer) return `No se encontro un cliente con nombre "${nombreCliente}".`;

  const { data, error } = await supabase
    .from("orders")
    .select("order_date, total_amount, status, order_items(product_name, quantity, unit_price, total_price)")
    .eq("customer_id", customer.id)
    .order("order_date", { ascending: false })
    .limit(ultimasN);

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return `${customer.name} no tiene ordenes registradas.`;

  return JSON.stringify({
    cliente: customer.name,
    ordenes: data.map((o) => ({
      fecha: o.order_date,
      total: formatCurrency(Number(o.total_amount)),
      estado: o.status,
      productos: (o.order_items as Array<{ product_name: string; quantity: number; total_price: number }>)
        .filter((item) => !["SHIPPING", "COMISIONES"].includes(item.product_name))
        .map((item) => ({
          producto: item.product_name,
          cantidad: item.quantity,
          subtotal: formatCurrency(Number(item.total_price)),
        })),
    })),
  });
}

// ============================================================
// Tool: productos_mas_vendidos
// ============================================================

async function execProductosMasVendidos(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const limite = (input.limite as number) || 10;
  const fechaInicio = input.fecha_inicio as string | undefined;
  const fechaFin = input.fecha_fin as string | undefined;

  // Traer order_items con la fecha de la orden para filtrar
  let query = supabase
    .from("order_items")
    .select("product_name, quantity, total_price, orders!inner(order_date, status)")
    .eq("orders.status", "completed");

  if (fechaInicio) {
    query = query.gte("orders.order_date", fechaInicio);
  }
  if (fechaFin) {
    query = query.lte("orders.order_date", fechaFin);
  }

  // Limitar filas para evitar traer datasets enormes a memoria
  const { data, error } = await query.limit(1000);
  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay datos de productos vendidos.";

  // Agregar en TypeScript: agrupar por product_name
  const grouped = new Map<string, { qty: number; revenue: number; orders: number }>();
  for (const item of data) {
    if (["SHIPPING", "COMISIONES"].includes(item.product_name)) continue;
    const existing = grouped.get(item.product_name) || { qty: 0, revenue: 0, orders: 0 };
    existing.qty += item.quantity;
    existing.revenue += Number(item.total_price);
    existing.orders += 1;
    grouped.set(item.product_name, existing);
  }

  const sorted = [...grouped.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limite);

  return JSON.stringify(
    sorted.map(([name, stats], i) => ({
      ranking: i + 1,
      producto: name,
      cantidad_total: stats.qty,
      facturacion_total: formatCurrency(stats.revenue),
      veces_ordenado: stats.orders,
    }))
  );
}

// ============================================================
// Tool: productos_cliente
// ============================================================

async function execProductosCliente(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const nombreCliente = input.nombre_cliente as string;
  const limite = (input.limite as number) || 5;

  const customer = await findCustomerByName(supabase, nombreCliente);
  if (!customer) return `No se encontro un cliente con nombre "${nombreCliente}".`;

  const { data, error } = await supabase.rpc("get_client_top_products", {
    p_customer_id: customer.id,
    p_limit: limite,
  });

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return `${customer.name} no tiene productos registrados.`;

  return JSON.stringify({
    cliente: customer.name,
    productos: data.map((p: { product_name: string; total_quantity: number; total_revenue: number; times_ordered: number }) => ({
      producto: p.product_name,
      cantidad_total: p.total_quantity,
      facturacion_total: formatCurrency(Number(p.total_revenue)),
      veces_ordenado: p.times_ordered,
    })),
  });
}

// ============================================================
// Tool: clientes_por_producto
// ============================================================

async function execClientesPorProducto(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const nombreProducto = input.nombre_producto as string;
  const limite = (input.limite as number) || 20;

  const { data, error } = await supabase
    .from("order_items")
    .select("product_name, quantity, total_price, orders!inner(customer_id, status, customers!inner(name))")
    .ilike("product_name", `%${nombreProducto}%`)
    .eq("orders.status", "completed")
    .limit(1000);

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0)
    return `No se encontraron ventas de productos que contengan "${nombreProducto}".`;

  // Recopilar las variantes de producto que matchearon (ej: colores, tamaños)
  const productVariants = new Set<string>();

  // Agrupar por cliente (sumando TODAS las variantes del producto)
  const grouped = new Map<string, { qty: number; revenue: number; orders: number }>();
  for (const item of data) {
    productVariants.add(item.product_name);
    const order = item.orders as unknown as { customers: { name: string } };
    const customerName = order.customers.name;
    const existing = grouped.get(customerName) || { qty: 0, revenue: 0, orders: 0 };
    existing.qty += item.quantity;
    existing.revenue += Number(item.total_price);
    existing.orders += 1;
    grouped.set(customerName, existing);
  }

  const sorted = [...grouped.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limite);

  return JSON.stringify({
    busqueda: nombreProducto,
    variantes_incluidas: [...productVariants].sort(),
    total_variantes: productVariants.size,
    nota: "Los totales por cliente SUMAN todas las variantes listadas arriba (todos los colores/tamaños). El ranking ya esta ordenado de mayor a menor.",
    ranking_clientes: sorted.map(([name, stats], i) => ({
      posicion: i + 1,
      cliente: name,
      cantidad_total: stats.qty,
      facturacion_total: formatCurrency(stats.revenue),
      veces_comprado: stats.orders,
    })),
  });
}

// ============================================================
// Tool: clientes_nuevos
// ============================================================

async function execClientesNuevos(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const fechaInicio = input.fecha_inicio as string;
  const fechaFin = input.fecha_fin as string;

  const { data, error } = await supabase
    .from("customers")
    .select("name, first_purchase_date, total_purchases_count, total_purchases_amount")
    .gte("first_purchase_date", fechaInicio)
    .lte("first_purchase_date", fechaFin)
    .order("first_purchase_date", { ascending: false });

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0)
    return `No hay clientes nuevos entre ${fechaInicio} y ${fechaFin}.`;

  return JSON.stringify({
    periodo: `${fechaInicio} a ${fechaFin}`,
    total_nuevos: data.length,
    clientes: data.map((c) => ({
      nombre: c.name,
      primera_compra: c.first_purchase_date,
      pedidos_totales: c.total_purchases_count,
      facturacion_total: formatCurrency(Number(c.total_purchases_amount)),
    })),
  });
}

// ============================================================
// Tool: predicciones
// ============================================================

async function execPredicciones(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const estado = input.estado as string | undefined;
  const vertical = input.vertical as string | undefined;
  const fechaInicio = input.fecha_inicio as string | undefined;
  const fechaFin = input.fecha_fin as string | undefined;

  let query = supabase
    .from("predictions")
    .select("status, vertical, prediction_date, priority, confidence_score, customers(name)");

  if (estado) query = query.eq("status", estado);
  if (vertical) query = query.eq("vertical", vertical);
  if (fechaInicio) query = query.gte("prediction_date", fechaInicio);
  if (fechaFin) query = query.lte("prediction_date", fechaFin);

  query = query.order("prediction_date", { ascending: false }).limit(50);

  const { data, error } = await query;
  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay predicciones con esos criterios.";

  // Contar por estado y vertical
  const byStatus: Record<string, number> = {};
  const byVertical: Record<string, number> = {};
  for (const p of data) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byVertical[p.vertical] = (byVertical[p.vertical] || 0) + 1;
  }

  return JSON.stringify({
    total: data.length,
    por_estado: byStatus,
    por_vertical: byVertical,
    detalle: data.slice(0, 15).map((p) => ({
      cliente: (p.customers as unknown as { name: string })?.name,
      vertical: p.vertical,
      estado: p.status,
      fecha: p.prediction_date,
      prioridad: p.priority,
      confianza: p.confidence_score,
    })),
  });
}

// ============================================================
// Tool: valor_pymepilot (usa RPC existente)
// ============================================================

async function execValorPymepilot(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const meses = (input.meses as number) || 6;

  const { data, error } = await supabase.rpc("get_monthly_value", {
    p_months: meses,
  });

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay predicciones convertidas en el periodo.";

  const totalValue = data.reduce(
    (sum: number, m: { attributed_value: number }) => sum + Number(m.attributed_value),
    0
  );
  const totalConverted = data.reduce(
    (sum: number, m: { predictions_converted: number }) => sum + m.predictions_converted,
    0
  );

  return JSON.stringify({
    resumen: {
      valor_total_generado: formatCurrency(totalValue),
      predicciones_convertidas: totalConverted,
    },
    por_mes: data.map((m: { month: string; attributed_value: number; predictions_converted: number }) => ({
      mes: m.month,
      valor: formatCurrency(Number(m.attributed_value)),
      convertidas: m.predictions_converted,
    })),
  });
}

// ============================================================
// Tool: tendencia_mensual (usa RPC existente)
// ============================================================

async function execTendenciaMensual(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const meses = (input.meses as number) || 6;

  const { data, error } = await supabase.rpc("get_monthly_revenue_split", {
    p_months: meses,
  });

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay datos de facturacion mensual.";

  return JSON.stringify(
    data.map((m: { month: string; total_revenue: number; recurring_revenue: number; new_revenue: number; recurring_pct: number }) => ({
      mes: m.month,
      total: formatCurrency(Number(m.total_revenue)),
      recurrente: formatCurrency(Number(m.recurring_revenue)),
      nueva: formatCurrency(Number(m.new_revenue)),
      porcentaje_recurrente: `${m.recurring_pct}%`,
    }))
  );
}

// ============================================================
// Tool: churn_mensual (usa RPC existente)
// ============================================================

async function execChurnMensual(
  supabase: SupabaseClient,
  input: ToolInput
): Promise<string> {
  const meses = (input.meses as number) || 6;

  const { data, error } = await supabase.rpc("get_monthly_churn", {
    p_months: meses,
  });

  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return "No hay datos de churn mensual.";

  return JSON.stringify(
    data.map((m: { month: string; active_prev: number; churned: number; churn_rate: number }) => ({
      mes: m.month,
      activos_mes_anterior: m.active_prev,
      perdidos: m.churned,
      tasa_churn: `${m.churn_rate}%`,
    }))
  );
}

// ============================================================
// Tool: resumen_negocio (combina multiples queries)
// ============================================================

async function execResumenNegocio(supabase: SupabaseClient): Promise<string> {
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = today.toISOString().split("T")[0];

  // Ejecutar queries en paralelo
  const [customersRes, ordersMonthRes, predictionsRes, recentOrdersRes] =
    await Promise.all([
      // Total clientes activos
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      // Facturacion del mes
      supabase
        .from("orders")
        .select("total_amount")
        .eq("status", "completed")
        .gte("order_date", firstOfMonth)
        .lte("order_date", todayStr),
      // Predicciones pendientes
      supabase
        .from("predictions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      // Ordenes recientes (ultimos 30 dias) para ticket promedio
      supabase
        .from("orders")
        .select("total_amount")
        .eq("status", "completed")
        .gte(
          "order_date",
          new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
        ),
    ]);

  const totalClientes = customersRes.count ?? 0;
  const facturacionMes = (ordersMonthRes.data ?? []).reduce(
    (sum, o) => sum + Number(o.total_amount),
    0
  );
  const ordenesMes = ordersMonthRes.data?.length ?? 0;
  const prediccionesPendientes = predictionsRes.count ?? 0;
  const recentOrders = recentOrdersRes.data ?? [];
  const ticketPromedio =
    recentOrders.length > 0
      ? recentOrders.reduce((sum, o) => sum + Number(o.total_amount), 0) /
        recentOrders.length
      : 0;

  return JSON.stringify({
    fecha: todayStr,
    clientes_activos: totalClientes,
    facturacion_mes_actual: formatCurrency(facturacionMes),
    ordenes_mes_actual: ordenesMes,
    ticket_promedio_30d: formatCurrency(ticketPromedio),
    predicciones_pendientes: prediccionesPendientes,
  });
}
