# Ideas de Soluciones PymePilot — Catálogo 2026

**Fecha:** 2026-03-04
**Estado:** Ideas para explorar (no comprometidas)
**Criterio:** Cada solución nace de un punto de dolor real del día a día en IEY

---

## PARTE 1: Soluciones Canal Mayorista (B2B)

Enfocadas en el vendedor mayorista y su relación con clientes distribuidores.

### 1. Cotizador Inteligente

**Dolor:** Armar cotizaciones es lento, los precios están desactualizados, no hay
seguimiento de qué cotizaciones se convirtieron en ventas.

**Solución:** Generador de cotizaciones que lee precios del ERP en tiempo real,
aplica márgenes por cliente/volumen, y trackea conversión.

**Potencial:** Altísimo — cualquier empresa que cotice es cliente potencial (no solo
distribuidores B2B). Mercado mucho más amplio que Predicciones.

---

### 2. Predicción de Stock Inteligente

**Dolor:** No sé qué producto se va a agotar hasta que un cliente lo pide y no hay.
Reposición reactiva = ventas perdidas.

**Solución:** Analizar velocidad de salida por producto, estacionalidad, y pedidos
pendientes para predecir cuándo se agota cada SKU y sugerir reposición antes
de que pase.

**Potencial:** Alto — conecta directamente con el módulo de Predicciones (no
recomendar un producto que no hay en stock).

---

### 3. Cobranzas Predictivas

**Dolor:** Cobro reactivo. No sé quién debe, cuánto, ni hace cuánto. Me entero
cuando la deuda ya es vieja.

**Solución:** Dashboard de cobranzas que muestra automáticamente: quién debe,
antigüedad de la deuda, historial de pago del cliente, y sugiere prioridad
de cobro basada en probabilidad de pago y monto.

**Potencial:** Alto — problema universal de cualquier PyME que vende a crédito.

---

### 4. WhatsApp Commerce Hub

**Dolor:** El vendedor mayorista vive en WhatsApp. Tiene que saltar entre WhatsApp,
el ERP, Excel, y el dashboard para hacer su trabajo.

**Solución:** Bot/integración que permite consultar stock, enviar cotizaciones,
registrar pedidos, y recibir alertas directamente desde WhatsApp.

**Potencial:** Medio-alto — depende de WhatsApp Cloud API. Diferenciador fuerte
si se logra una experiencia fluida.

---

### 5. Pricing Dinámico

**Dolor:** Los precios cambian frecuentemente (inflación Argentina, variaciones
de costo), actualizar listas de precios es manual y propenso a errores.

**Solución:** Motor que detecta cambios en costos del ERP, calcula márgenes
objetivo, y sugiere/aplica ajustes de precios automáticamente. Alertas
cuando un producto tiene margen negativo o demasiado bajo.

**Potencial:** Alto para mercado argentino — la inflación hace que esto sea
un dolor diario.

---

### 6. Cash Flow Predictivo

**Dolor:** No sé cuánta plata va a entrar ni salir este mes. Las decisiones
financieras se toman a ciegas.

**Solución:** Proyección de flujo de caja basada en ventas históricas, cobranzas
pendientes, pagos a proveedores, y estacionalidad. Alertas de posibles
baches de liquidez.

**Potencial:** Medio — más complejo de implementar, pero resuelve un dolor
universal de PyMEs.

---

### 7. Score de Salud del Cliente

**Dolor:** No tengo visibilidad de qué clientes están contentos y cuáles están
por irse, hasta que se fueron.

**Solución:** Score compuesto que combina: frecuencia de compra, ticket promedio,
tendencia (creciendo/cayendo), velocidad de pago, diversidad de productos.
Alertas automáticas cuando un cliente "sano" empieza a deteriorarse.

**Potencial:** Alto — ya tenemos los datos en Predicciones. Es una capa de
inteligencia sobre datos existentes.

---

### 8. Procesador de Documentos Inteligente

**Dolor:** Llegan órdenes de compra, remitos, facturas en PDF, email, WhatsApp.
Cargar todo al ERP es manual y tedioso.

**Solución:** Claude parsea documentos (como ya hace con Smart File Upload),
extrae datos relevantes, y los carga o prepara para carga en el ERP.

**Potencial:** Medio-alto — extensión natural de Smart File Upload. Diferenciador
por la capacidad de Claude para entender documentos no estructurados.

---

### 9. Optimización de Despacho

**Dolor:** Preparar pedidos es manual, propenso a errores, y no hay visibilidad
del estado de cada pedido (preparado, despachado, entregado).

**Solución:** Sistema que toma las órdenes de venta, genera listas de picking
optimizadas (por ubicación en depósito), trackea estado del despacho, y
notifica al cliente.

**Potencial:** Alto — conecta ventas con depósito. Resuelve un dolor operativo
diario.

---

### 10. Scoring de Proveedores

**Dolor:** No tengo forma objetiva de evaluar proveedores. ¿Quién entrega a
tiempo? ¿Quién tiene mejor precio? ¿Quién me falla seguido?

**Solución:** Registro automático de entregas (fecha prometida vs real), precios
históricos, calidad (devoluciones), y score comparativo entre proveedores
del mismo producto.

**Potencial:** Medio — requiere datos que no siempre están en el ERP. Valioso
pero más complejo de implementar.

---

## PARTE 2: Soluciones Depósito (Mayorista + Minorista MercadoLibre)

Enfocadas en las operaciones del depósito que atiende DOS canales:
el canal mayorista (B2B) y el canal minorista (principalmente MercadoLibre).

### 1. Control de Inventario en Tiempo Real

**Dolor:** No sé qué hay en el depósito hasta que voy a fijarme físicamente.
El ERP dice una cosa, la realidad otra.

**Solución:** Sistema de inventario con lectura de código de barras (celular),
conteo cíclico guiado por IA (prioriza productos de alta rotación), y
reconciliación automática ERP vs stock físico. Alertas de discrepancia.

**Impacto:** Fundacional — todo lo demás del depósito depende de saber qué hay.

---

### 2. Sincronizador de Stock Multi-Canal

**Dolor:** El mismo producto se vende por mayorista y por MercadoLibre. Si vendo
50 unidades por mayorista y no actualizo MercadoLibre, vendo lo que no tengo.
O peor: freno publicaciones "por las dudas" y pierdo ventas.

**Solución:** Motor que mantiene sincronizado el stock disponible entre canal
mayorista y MercadoLibre. Define reservas por canal (ej: "siempre dejar 10
unidades para mayorista"), actualiza publicaciones automáticamente, y alerta
cuando un producto está bajo en ambos canales.

**Impacto:** Crítico — el dolor #1 de operar dos canales desde el mismo depósito.

---

### 3. Optimizador de Publicaciones MercadoLibre

**Dolor:** Publicar productos en MercadoLibre es tedioso: fotos, descripción,
precio, categoría, ficha técnica. Hay que mantener decenas o cientos de
publicaciones actualizadas.

**Solución:** Generador automático de publicaciones usando Claude: toma datos del
producto del ERP (nombre, categoría, atributos), genera título SEO-optimizado,
descripción atractiva, y ficha técnica. Actualización masiva de precios
cuando cambian los costos.

**Impacto:** Alto — ahorra horas de trabajo manual y mejora el posicionamiento.

---

### 4. Picking Inteligente Multi-Canal

**Dolor:** Los pedidos de MercadoLibre llegan todo el día (urgentes, con SLA de
despacho). Los pedidos mayoristas se preparan en batch. Mezclar ambos flujos
es caótico.

**Solución:** Sistema de picking que recibe pedidos de ambos canales, los prioriza
por urgencia (MeLi tiene deadline de despacho), genera rutas de picking
optimizadas por ubicación en depósito, y agrupa pedidos cercanos para
minimizar recorridos.

**Impacto:** Alto — eficiencia operativa directa, menos errores, más pedidos/hora.

---

### 5. Dashboard de Rentabilidad por Canal

**Dolor:** Vendo por mayorista y por MercadoLibre pero no sé cuál me deja más
plata por producto. MeLi cobra comisión + envío + impuestos. Mayorista tiene
descuentos por volumen. ¿Dónde conviene vender cada producto?

**Solución:** Calculadora que toma el costo del producto, aplica comisiones MeLi
(por categoría), costos de envío, impuestos, y compara con el margen
mayorista neto. Sugiere en qué canal priorizar cada SKU.

**Impacto:** Alto — decisiones de pricing y canal basadas en datos, no intuición.

---

### 6. Alertas de Reposición Inteligente

**Dolor:** Me entero que falta producto cuando un cliente lo pide y no hay, o
cuando MercadoLibre pausa la publicación por falta de stock.

**Solución:** Predicción de agotamiento por SKU basada en velocidad de venta por
canal (mayorista tiene patrones distintos a MeLi), lead time del proveedor,
y stock mínimo configurable. Genera órdenes de compra sugeridas con
cantidades óptimas.

**Impacto:** Crítico — evita ventas perdidas y pausas en MercadoLibre.

---

### 7. Gestión de Devoluciones y Reclamos

**Dolor:** MercadoLibre tiene un sistema de reclamos con plazos estrictos. Las
devoluciones mayoristas son informales. En ambos casos, el producto vuelve
al depósito y hay que decidir: ¿se reintegra al stock? ¿se devuelve al
proveedor? ¿se descarta?

**Solución:** Workflow de devoluciones que clasifica el motivo, sugiere acción
(reintegrar/devolver/descartar), actualiza el stock automáticamente, y
trackea métricas de devolución por producto y por canal. Alertas cuando
un producto tiene tasa de devolución alta.

**Impacto:** Medio-alto — especialmente importante en MercadoLibre donde las
métricas de vendedor afectan la visibilidad.

---

### 8. Etiquetador y Despacho MercadoLibre

**Dolor:** Imprimir etiquetas de envío, preparar paquetes, y marcar como
despachado en MeLi es repetitivo. Con volumen, es fácil equivocarse de
etiqueta o marcar mal un envío.

**Solución:** Integración con la API de MercadoLibre para: descargar etiquetas
en batch, validar que el producto correcto va en el paquete correcto
(escaneo de barras), y marcar como despachado automáticamente al confirmar.

**Impacto:** Alto con volumen — escala linealmente. A más ventas MeLi, más
tiempo ahorra.

---

### 9. Mapa de Calor del Depósito

**Dolor:** Los productos están ubicados "donde hay lugar". Los más vendidos
a veces están al fondo. Se pierde tiempo buscando y recorriendo.

**Solución:** Mapeo de ubicaciones del depósito con análisis de frecuencia de
acceso. Sugiere reorganización: productos de alta rotación cerca de la zona
de despacho, productos de baja rotación al fondo. Visualización tipo mapa
de calor.

**Impacto:** Medio — mejora incremental pero acumulativa. Más valioso a
medida que el depósito crece.

---

### 10. Tablero de Control del Jefe de Depósito

**Dolor:** No hay visibilidad consolidada de las operaciones del depósito.
¿Cuántos pedidos se prepararon hoy? ¿Cuántos errores? ¿Cuánto stock
se movió? ¿Estamos al día con MercadoLibre?

**Solución:** Dashboard operativo que muestra en tiempo real: pedidos pendientes
por canal, pedidos preparados/despachados, SLA de MercadoLibre (% despachado
a tiempo), discrepancias de inventario, y productividad por operario.
Alertas cuando un SLA está en riesgo.

**Impacto:** Alto — visibilidad = control. El jefe de depósito deja de
"ir a ver" y empieza a gestionar con datos.

---

## Criterio de priorización

Cuando Pato detecte un punto de dolor en el día a día, buscar en este
catálogo qué solución lo resuelve. Las que más duelen → se construyen primero.

**Factores para priorizar:**

| Factor | Pregunta |
|--------|----------|
| Frecuencia | ¿Cuántas veces por semana duele? |
| Impacto | ¿Cuánto tiempo/plata se pierde cada vez? |
| Datos disponibles | ¿Ya tenemos los datos necesarios o hay que conseguirlos? |
| Conexión con módulos existentes | ¿Se potencia con Predicciones u otro módulo? |
| Mercado potencial | ¿Cuántas PyMEs tienen este mismo dolor? |

---

## Referencias

- Visión anual 2026: `docs/plans/2026-03-04-annual-vision-2026.md`
- Arquitectura multi-módulo: `docs/plans/2026-03-04-platform-architecture-vision.md`
- Diario de puntos de dolor: sección en la visión anual
