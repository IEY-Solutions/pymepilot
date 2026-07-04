# Fallas y Problemas Detectados - PymePilot

**Fecha de auditoría:** Junio 2026
**Auditor:** Claude (recorrido en modo lectura)
**Alcance:** Todas las pantallas principales (Inicio, Pipeline, Cuentas Clave, Métricas, Mis Ventas, Cotizaciones, Datos, Asesor IA, Guía)

---

## 🔴 Problemas Críticos

### 1. Contradicciones de datos entre pantallas

**Ubicación:** Mis Ventas vs Métricas

- **Mis Ventas** muestra: "28 órdenes · $14.1M en junio" pero el cuerpo dice "Todavía sin ventas este mes"
- **Mis Ventas** dice: "Ventas con PymePilot: Sin ventas asistidas"
- **Métricas** afirma: "Valor PymePilot $20.7M / 28 predicciones convertidas"

**Impacto:** Las dos pantallas se contradicen. Una de las dos está calculando mal o usando fuentes distintas.

**Causa probable:** Métricas calculadas por pantalla en lugar de usar una única fuente de verdad en backend.

---

### 2. Churn mal calculado y mal presentado

**Ubicación:** Métricas > Rendimiento y Comparar

- **Rendimiento:** Churn 81% con "+21.0pp vs mes ant." en verde (positivo) ❌
- **Comparar:** Mismo dato en rojo con flecha hacia abajo ✓
- **Incoherencia lógica:** Churn mensual del 81.4% convive con 86% de facturación recurrente

**Impacto:** Un churn del 81% mensual es insostenible. La fórmula está contando como "perdidos" a clientes que simplemente no compraron en la ventana, sin período de gracia.

**Causa probable:** Definición de churn sin ventana de inactividad ni período de gracia adecuado.

---

### 3. Errores del backend expuestos crudos al usuario

**Ubicación:** Cotizaciones

Mensajes técnicos visibles:
- "Failed to resolve 'rest.contabilium.com'" (DNS failure)
- "Expecting ',' delimiter: line 128 column 27" (JSON parse error)
- "No se detectaron items en la cotización"
- "aumente DAILY_TOKEN_LIMIT en .env" (instrucción interna)

**Impacto:** El usuario final ve stack traces, nombres de hosts internos y variables de entorno.

**Causa probable:** Falta de capa de traducción de errores técnicos a mensajes amigables.

---

## 🟡 Problemas de Datos

### 4. Estado del ERP posiblemente engañoso

**Ubicación:** Datos

- Muestra: "Conexión ERP: Contabilium — Conectado / Datos sincronizados correctamente"
- Pero en Cotizaciones hay error reciente de DNS hacia Contabilium

**Impacto:** El badge "Conectado" refleja la última sync exitosa, no el estado real en tiempo real.

**Causa probable:** Falta de health check continuo o heartbeat del connector ERP.

---

### 5. Conteos de productos inconsistentes

**Ubicación:** Múltiples pantallas

- **Datos:** 2423 productos en base
- **Productos (ranking):** 293 productos
- **Demanda:** 289 productos activos

**Impacto:** Tres números distintos para "productos" según la pantalla.

**Causa probable:** Cada pantalla filtra/agrega de forma distinta (total vs activos vs con ventas).

---

### 6. Pipeline incoherente

**Ubicación:** Pipeline

- Total: 90 clientes (69 En Seguimiento + 21 Vendido = 90) ✓
- Pero: A Contactar, Contactado, Por Cotizar, Cotización Enviada = 0
- Tarjetas con "Seguimiento 1/3 — Hoy" + etiqueta "Vencida" simultáneamente
- Clientes duplicados: Leonardo Daniel Panella, Baltazar Agliozzo, Franco Pereyra (varias veces en misma columna)

**Impacto:** El kanban pierde sentido si nada fluye por etapas intermedias. Estados contradictorios y duplicados.

**Causa probable:** Falta de deduplicación, lógica de estados mal definida, etapas intermedias no se están poblando.

---

### 7. Datos de producto mal clasificados

**Ubicación:** Productos (ranking)

- SKUs dicen "MAGCASE - IPHONE..." pero son Samsung:
  - Puesto 112: "MAGCASE - IPHONE ANILLO 360 NEGRO - SAMSUNG S26 ULTRA"
  - Puestos 129, 229, 237, 259, 277, 285 (similares)
- Ítem #293: "$0" de facturación con 1 unidad vendida (precio faltante)

**Impacto:** Clasificación errónea de productos y datos incompletos.

**Causa probable:** Nombres de producto inconsistentes en origen (ERP) o falta de normalización.

---

### 8. Datos de clientes sin normalizar

**Ubicación:** Clientes

- Nombres con sufijos legales duplicados: "MOVIL STORE S.A. S. A.", "USHUAIA TECH SRL S. R. L."
- Nombre roto: "SUIPCELL SOCIEDAD LEY 19550 CAPITULO I SECCION IV"
- Mezcla de mayúsculas y formato normal: "Ivan Morales" vs otros en mayúsculas
- Columna "TEND." (tendencia) vacía en todas las filas

**Impacto:** Calidad de datos pobre, feature de tendencia no funciona.

**Causa probable:** Falta de pipeline de normalización de nombres y tendencia no implementada o sin datos.

---

## 🟠 Problemas Técnicos

### 9. Errores de React en consola

**Ubicación:** Bundle de Next.js (consola del navegador)

- React error #418 (hidratación)
- Error de hidratación de HTML/texto

**Impacto:** Desajuste servidor/cliente que puede causar parpadeos o contenido inconsistente.

**Causa probable:** Componentes que renderizan distinto en SSR vs cliente (fechas, random, window, etc).

---

### 10. Problema de layout

**Ubicación:** Asesor IA

- Banner fijo de notificaciones se superpone al encabezado de la página
- El título queda parcialmente tapado

**Impacto:** Problema de UX menor pero molesto.

**Causa probable:** z-index o espaciado mal configurado.

---

---

## 🔴 Segunda auditoría (Junio 2026, Claude en app.pymepilot.cloud)

Hallazgos nuevos que no estaban en la primera auditoría:

| # | Severidad | Área | Hallazgo |
|---|-----------|------|----------|
| N1 | 🔴 Alta | Disponibilidad | Asesor IA caído: `POST /api/chat` 502 |
| N2 | 🔴 Alta | Escalabilidad | Prefetch RSC Next.js devolviendo 503 en varias rutas |
| N3 | 🔴 Alta | Seguridad/Privacidad | API expone `tenant_id`, `customer_id`, `prediction_id` y PII de clientes |
| N4 | 🟠 Media | UX / lógica | Cuenta "Crítico" sin alertas ni acciones en Cuentas Clave (8/9 rojas) |
| N5 | 🟡 Baja | Seguridad | Carga Excel sin validación robusta (XXE/zip-bomb/fórmulas) |
| N6 | 🟡 Baja | Accesibilidad | KPIs como `<generic>`, nav solo-iconos, valores no en árbol accesible |
| N7 | 🟡 Baja | Seguridad | Headers HTTP sin verificar (CSP, HSTS, etc.) — pendiente revisión manual |

---

## 📋 Resumen de Prioridades (fusionado)

| Prioridad | Problema | Impacto | Fuente |
|-----------|----------|---------|--------|
| 🔴 P0 | Asesor IA caído (502) | Alta - feature rota | 2ª auditoría |
| 🔴 P0 | Prefetch RSC 503 | Alta - navegación intermitente | 2ª auditoría |
| 🔴 P0 | Exposición de IDs internos y PII en API | Alta - seguridad | 2ª auditoría |
| 🔴 P0 | Contradicciones de datos entre pantallas | Alta - rompe confianza | Ambas |
| 🔴 P0 | Churn mal calculado (81%) | Alta - métrica clave errónea | Ambas |
| 🔴 P0 | Errores backend expuestos crudos | Alta - seguridad y UX | 1ª auditoría |
| 🟡 P1 | Pipeline desbalanceado + incoherente | Media - funcionalidad rota | Ambas |
| 🟡 P1 | Estado ERP engañoso | Media - puede confundir | 1ª auditoría |
| 🟡 P1 | Conteos inconsistentes | Media - falta de claridad | 1ª auditoría |
| 🟡 P1 | Estado "Crítico" sin justificación en CC | Media - pérdida de credibilidad | 2ª auditoría |
| 🟡 P1 | Productos mal clasificados | Media - calidad de datos | 1ª auditoría |
| 🟡 P1 | Clientes sin normalizar | Media - calidad de datos | 1ª auditoría |
| 🟠 P2 | Carga Excel sin validación | Baja - vector de ataque | 2ª auditoría |
| 🟠 P2 | Accesibilidad limitada | Baja - lectores de pantalla | 2ª auditoría |
| 🟠 P2 | Headers seguridad sin verificar | Baja - hardening | 2ª auditoría |
| 🟠 P2 | Errores de hidratación React | Baja - molesto | 1ª auditoría |
| 🟠 P2 | Layout Asesor IA (banner tapa título) | Baja - UX menor | 1ª auditoría |

---

## 🎯 Plan de acción

### 🔧 AHORA — Arreglar lo roto (lo que ya debería funcionar)

Esto no son mejoras, son **reparaciones de features ya vendidas** que hoy no funcionan o funcionan mal.

#### Bloque 1: Lo que está caído (crítico, impacta al usuario HOY)

1. **Revivir el Asesor IA (`POST /api/chat` → 502)**
   - Healthcheck del upstream LLM, circuit breaker, reintentos con backoff
   - Estado degradado explícito ("el asesor no está disponible ahora") en vez de error genérico
   - Alerting automático cuando el endpoint no responde

2. **Resolver los 503 del prefetch RSC de Next.js**
   - Investigar si es cold-start de serverless, saturación o timeout
   - Degradar graceful: si el prefetch falla, que la navegación no se rompa
   - Verificar si comparte infraestructura con el Asesor (¿mismo upstream?)

3. **Sanitizar lo que expone la API (seguridad + privacidad)**
   - Eliminar `tenant_id` del payload al cliente (validar por sesión server-side, no confiar en el request)
   - No enviar `prediction_id`, `confidence_factors`, `vertical_version` al front
   - Aplicar minimización de datos: mandar solo lo que la UI renderiza
   - Verificar que toda query filtre por el tenant de la sesión (no por parámetro)

#### Bloque 2: Lo que miente (métricas contradictorias)

4. **Una única fuente de verdad para métricas**
   - Un servicio backend que calcule: ventas asistidas, churn, predicciones convertidas, pendientes
   - Todas las pantallas (Inicio, Métricas, Mis Ventas) consumen del mismo endpoint
   - Definir período consistente (mes calendario vs últimos 30 días)

5. **Recalcular el churn**
   - Definir ventana de inactividad con período de gracia (ej: 90 días)
   - Unificar color/icono de tendencia entre Rendimiento y Comparar
   - Agregar tooltip con la fórmula y sanity-check (churn + recurrencia ≈ 100%)

6. **Traducir errores técnicos a mensajes amigables**
   - Capa intermedia que mapee stack traces a lenguaje de usuario
   - Nunca mostrar `rest.contabilium.com`, `DAILY_TOKEN_LIMIT`, line numbers

#### Bloque 3: Lo que funciona a medias (pipeline, cuentas clave)

7. **Arreglar el Pipeline (kanban)**
   - Investigar por qué "A contactar" está en 0 — ¿el job de 5 AM no corre?
   - Resolver duplicados de clientes en columnas
   - Corregir estados contradictorios ("Seguimiento 1/3 — Hoy" + "Vencida")

8. **Darle sentido al score de Cuentas Clave**
   - Mostrar los factores que disparan "Crítico" (días desde última compra, caída de ticket, etc.)
   - Recuperar el banner de "cuentas que necesitan atención"
   - Revisar si el cálculo del score está dominado por un solo factor

9. **Health check real del ERP**
   - No mostrar "Conectado" si hace 24h que no sincroniza
   - Heartbeat periódico, alertar si falla

10. **Deduplicación y normalización de datos**
    - Nombres de clientes (sufijos legales duplicados, mayúsculas)
    - Nombres de productos (iPhone vs Samsung mal clasificados)
    - Unificar conteos de productos con labels claros (total vs activos vs con ventas)

---

### 🚀 PRONTO — Mejoras para "perseguir" mejor a los distribuidores

Acá pensemos en la misión del producto: **que los distribuidores nos elijan primero**. Esto va más allá de arreglar bugs.

#### Propósito del producto (para IEY):
> Usar datos de facturación → generar predicciones de a quién contactar hoy → darle al vendedor el mensaje listo → medir cuánto vendió gracias al sistema.

Cada mejora tiene que servir a **que el distribuidor actúe más rápido, con mejor información, y que IEY sea el primero en el que piensa**.

#### Mejoras de producto

**A. Que el Pipeline realmente empuje la acción diaria**
- **Notificación push/email matutina**: "Hoy tenés 12 clientes para contactar" con link directo al Pipeline
- **Recordatorio de seguimiento**: si una tarjeta lleva 3+ días en "Contactado" sin avanzar, que aparezca un badge o notificación
- **Métricas de velocidad del vendedor**: cuánto tarda en promedio desde "A contactar" hasta "Vendido" — gamificación real, no solo rachas
- **Auto-avance inteligente**: si el vendedor no mueve la tarjeta en X días, sugerir acción (¿archivar?, ¿recontactar?) en vez de dejarla pudrirse en "En seguimiento"

**B. Que los mensajes sugeridos sean IRRESISTIBLES**
- **Personalización por perfil de cliente**: no es lo mismo un local chico que una cadena — el mensaje debería adaptar el tono y los productos sugeridos
- **Contexto de la última compra**: "Juan, vi que en marzo compraste 20 cargadores MagCase — ¿cómo vienen rotando? Justo entró el nuevo modelo con soporte para S26"
- **A/B testing de mensajes**: ¿qué apertura convierte más? ¿"Te paso los nuevos precios" o "Tus clientes están pidiendo esto"?
- **Biblioteca de objeciones**: que el vendedor pueda buscar "¿qué respondo si me dicen que es caro?" y el sistema le tire 3 respuestas con datos de margen

**C. Que las métricas le hablen al dueño/comercial de IEY**
- **Dashboard de adopción por distribuidor**: ¿quién usa el sistema y quién no? ¿Quién abre los mensajes pero no contacta?
- **ROI tangible por distribuidor**: "Desde que usa PymePilot, este distribuidor aumentó su ticket promedio 22%"
- **Ranking competitivo entre distribuidores** (opt-in, anonimizado): "Estás en el top 15% de distribuidores que más usan las predicciones" — presión social positiva
- **Proyección de demanda**: con los datos de todos los distribuidores, anticipar qué productos van a necesitar en 30/60/90 días para que IEY fabrique/pre-importe mejor

**D. Que el Asesor IA sea el copiloto de ventas, no un chatbot genérico**
- **Consultas accionables**: "¿A qué clientes no estoy contactando hace más de 2 meses?" en vez de "cómo viene el negocio"
- **Sugerencias proactivas**: cuando el vendedor entra a las 9 AM, el Asesor ya le tiró "Hoy te conviene llamar primero a Distribuidora Norte porque su último pedido fue hace 45 días y siempre compra en esta época"
- **Reportes narrados**: "Esta semana tu facturación subió 12% respecto a la anterior, traccionada por 3 clientes que volvieron a comprar después de 4 meses"

**E. Que el onboarding enganche desde el minuto 1**
- **Setup wizard que muestre valor en la primera sync**: apenas conecta el ERP, que ya le diga "detectamos 47 clientes sin contacto en 60 días — ¿querés que te preparemos la lista para mañana?"
- **Demo mode con datos sintéticos realistas**: para que un distribuidor nuevo pueda explorar sin conectar su ERP todavía
- **Primer "quick win" garantizado**: el día 1, el sistema le entrega 3 clientes para contactar con mensaje listo y le dice "si contactás a estos 3, según nuestro modelo tenés 70% de probabilidad de vender"

**F. Higiene técnica que impacta en el producto**
- **Caché de respuestas frecuentes del Asesor** (mismo prompt → misma respuesta por N horas, baja costo de API)
- **Paginación/virtualización** del Pipeline y listas para tenants con 500+ clientes
- **Observabilidad end-to-end**: dashboard de salud de la app (¿está caído el Asesor? ¿falló el job de 5 AM?)
- **Rate-limit server-side** en `/api/chat` (20 consultas/día ya está en front, validar también en backend)

---

### ⏳ Más adelante (2-3 meses)

- Resolver errores de hidratación React (SSR vs cliente)
- Accesibilidad: headings semánticos, aria-labels, navegación por teclado en Kanban
- Headers de seguridad HTTP (CSP, HSTS, X-Frame-Options)
- Endurecer carga de Excel (validación de magic bytes, límites, antivirus, parser sin XXE)
- Implementar columna de tendencia de clientes o eliminarla

---

## 📝 Notas Adicionales

- Las 9 cotizaciones con "Cliente sin asignar" sugieren falta de detección automática o paso de asignación manual.
- El problema de churn es el más urgente porque es una métrica clave del negocio y está mal calculada.
- Las contradicciones entre pantallas rompen la confianza del usuario en el sistema.

---

**Próximos pasos:** Priorizar P0 (contradicciones, churn, errores expuestos) antes de avanzar con nuevas features.
