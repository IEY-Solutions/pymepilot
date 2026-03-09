/**
 * Diccionario centralizado de tooltips.
 * Clave = pagina.dato, Valor = explicacion corta (1-2 lineas).
 *
 * Para agregar un tooltip nuevo:
 * 1. Agregar la entrada aca
 * 2. Importar TOOLTIPS en el componente
 * 3. Usar <InfoTooltip text={TOOLTIPS["clave"]} />
 */
export const TOOLTIPS = {
  // ============================================================
  // HOME
  // ============================================================
  "home.pendientes":
    "Predicciones que PymePilot genero y todavia no contactaste. Cada una es un cliente que te conviene llamar hoy.",
  "home.tasa_contacto":
    "De todas las predicciones que PymePilot genero, que porcentaje contactaste. Cuanto mas alto, mejor estas aprovechando las recomendaciones.",
  "home.clientes_activos":
    "Clientes que compraron en los ultimos 90 dias. Si baja, puede haber clientes por recuperar.",
  "home.ultima_sync":
    "Hace cuanto se sincronizaron los datos con tu ERP. Si dice mas de 48hs, los datos pueden estar desactualizados.",

  // ============================================================
  // CONTACTAR
  // ============================================================
  "contactar.pendientes":
    "Cantidad de clientes sugeridos para contactar hoy que todavia no marcaste como contactados.",
  "contactar.prioridad":
    "Urgencia de contacto segun el analisis de PymePilot. Urgente = cliente en riesgo de perderse. Baja = oportunidad sin apuro.",
  "contactar.vertical":
    "Tipo de prediccion: Reposicion (ya le toca comprar), Activacion (cliente nuevo), Cross-sell (puede comprar algo mas), Recuperacion (dejo de comprar).",
  "contactar.confianza":
    "Que tan seguro esta PymePilot de que este cliente va a comprar si lo contactas. Mas alto = mas probable.",
  "contactar.ultima_compra":
    "Hace cuanto fue la ultima vez que este cliente te compro.",
  "contactar.sort_urgentes":
    "Ordena por prioridad: primero los clientes que necesitan atencion inmediata.",
  "contactar.sort_importantes":
    "Ordena por facturacion total: primero los clientes que mas plata te generan.",
  "contactar.sort_potencial":
    "Ordena por monto potencial: combina la confianza de PymePilot con la facturacion del cliente.",
  "contactar.sort_recientes":
    "Ordena por fecha de prediccion: primero las mas nuevas.",

  // ============================================================
  // METRICAS — KPIs
  // ============================================================
  "metricas.ventas_mes":
    "Total de ordenes y facturacion del mes en curso. La comparacion es contra el mes anterior.",
  "metricas.recurrente":
    "Porcentaje de la facturacion que viene de clientes que ya compraron antes. Mas alto = negocio mas estable.",
  "metricas.churn":
    "Porcentaje de clientes que dejaron de comprar este mes. Menos de 10% es bueno (verde), mas de 15% es alerta roja.",
  "metricas.ticket":
    "Monto promedio por pedido. Se divide entre clientes recurrentes y nuevos para ver si hay diferencia.",
  "metricas.valor_pymepilot":
    "Facturacion total de clientes que contactaste por recomendacion de PymePilot y despues compraron.",

  // ============================================================
  // METRICAS — Graficos
  // ============================================================
  "metricas.chart_revenue":
    "Facturacion mes a mes. La linea verde (recurrente) deberia crecer. La linea amarilla (nueva) es facturacion de clientes primerizos.",
  "metricas.chart_churn":
    "Evolucion del churn. La linea verde punteada (10%) es el objetivo. La roja (15%) es el limite de alerta.",
  "metricas.chart_ticket":
    "Ticket promedio por tipo de cliente. Si los recurrentes tienen ticket mas alto, el negocio es saludable.",
  "metricas.chart_value":
    "Facturacion atribuida a PymePilot mes a mes. Muestra cuanto valor generan las recomendaciones.",

  // ============================================================
  // METRICAS — Ranking clientes
  // ============================================================
  "metricas.ranking_tendencia":
    "Compara la posicion de este cliente con el mes anterior. Flecha arriba = subio en el ranking.",
  "metricas.ranking_facturacion":
    "Total facturado por este cliente en el periodo. La barra muestra la proporcion vs el cliente #1.",
  "metricas.ranking_compras":
    "Cantidad total de pedidos de este cliente.",
  "metricas.ranking_ticket":
    "Monto promedio por pedido de este cliente.",
  "metricas.ranking_ultima_compra":
    "Hace cuantos dias fue la ultima compra. Si dice mas de 30d, puede estar en riesgo de churn.",
  "metricas.ranking_freq":
    "Promedio de dias entre compras. ~7d significa que compra cada semana aproximadamente.",

  // ============================================================
  // DATOS
  // ============================================================
  "datos.freshness":
    "Indica que tan actualizados estan tus datos. Verde = frescos (menos de 48hs). Amarillo = algo viejos. Rojo = desactualizados.",
  "datos.registros":
    "Cantidad de cada tipo de dato almacenado en PymePilot: clientes, productos, pedidos y predicciones.",
  "datos.sync_source":
    "De donde vinieron los datos: API (conexion directa al ERP), Excel (archivo subido), Drive (carpeta de Google Drive), Smart File (archivo inteligente).",
  "datos.sync_counts":
    "C = Clientes sincronizados, P = Productos sincronizados, O = Ordenes (pedidos) sincronizadas.",

  // ============================================================
  // HISTORIAL
  // ============================================================
  "historial.confianza":
    "Porcentaje de confianza que tenia PymePilot cuando genero esta prediccion.",
  "historial.status":
    "Estado de la prediccion: Pendiente (sin atender), Contactado (lo llamaste), Ignorado (lo descartaste), Completado (compro), Expirado (paso la ventana).",

  // ============================================================
  // LOGROS
  // ============================================================
  "logros.ventas_mes":
    "Todas tus ventas del mes actual, independientemente de si PymePilot las sugirio o no.",
  "logros.ventas_pymepilot":
    "Ventas que vinieron de clientes que PymePilot te recomendo contactar y despues compraron. Es el valor directo que te genera la herramienta.",
  "logros.racha":
    "Dias consecutivos en los que cerraste al menos una venta. PymePilot te ayuda a mantener la racha con recomendaciones diarias.",

  // ============================================================
  // PIPELINE
  // ============================================================
  "pipeline.a_contactar":
    "Clientes que PymePilot recomienda contactar. Abri la card, contacta al cliente y registra el resultado. Si pasan 3 dias sin contacto, se marcan como vencidas.",
  "pipeline.contactado":
    "Ya contactaste a este cliente, esperando su respuesta. Cuando conteste, abri la card y registra como fue.",
  "pipeline.en_seguimiento":
    "Clientes que no respondieron al primer contacto. PymePilot programa una secuencia de seguimiento para insistir.",
  "pipeline.por_cotizar":
    "Clientes que pidieron cotizacion. El proximo paso es enviarles la cotizacion.",
  "pipeline.cotizacion_enviada":
    "Cotizaciones enviadas esperando respuesta del cliente.",
  "pipeline.vendido":
    "Ventas cerradas. El cliente compro y el ciclo del pipeline se completo.",
  "pipeline.vencida":
    "Esta card tiene mas de 3 dias sin ser contactada. Todavia podes contactarla o descartarla.",
} as const;
