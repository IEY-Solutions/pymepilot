# PymePilot - Product Requirements Document (PRD)

**Version:** 1.0
**Fecha:** 2026-02-19
**Autor:** Pato (fundador) + Claude Code
**Estado:** En desarrollo

---

## 1. Vision y Problema

### El problema

Los distribuidores mayoristas B2B en Argentina dependen de sus equipos comerciales para mantener y hacer crecer su base de clientes. Pero estos equipos trabajan "a ciegas":

- **No saben a quien contactar** — No tienen forma sistematica de saber que cliente necesita reponer stock
- **No saben cuando contactar** — Llegan tarde (cuando el cliente ya compro a la competencia) o demasiado temprano (cuando todavia tiene stock)
- **No saben que ofrecer** — Ofrecen lo mismo a todos, sin personalizar segun historial

El resultado: clientes que se pierden, oportunidades de venta que se escapan, y equipos comerciales que dependen de la intuicion en vez de datos.

### La solucion

**PymePilot** es un sistema de Business Intelligence que transforma el historial de compras de un distribuidor en acciones comerciales concretas y automatizadas.

En vez de que el vendedor piense "a quien llamo hoy?", PymePilot le dice:

> "Contacta a Juan hoy. En 5 dias se le acaba el stock de fundas MagSafe (compra cada 28 dias, ultimo pedido fue hace 23 dias). Ofrecele reservar 50 unidades de funda MagSafe + 30 protectores de pantalla que nunca compro pero clientes similares si."

### Validacion real

Este sistema fue validado manualmente durante 6 meses en **IEY** (Distribuidor #1 de Accesorios MagSafe en Argentina):

| Metrica | Antes | Despues | Mejora |
|---|---|---|---|
| Facturacion recurrente | 34% | 74% | **+114.8%** |
| Clientes perdidos/mes | 18% | 8% | **-56%** |
| Ticket promedio recurrente vs nuevo | - | +88.4% | **+88.4%** |
| Conversion nuevos a recurrentes | 30% | 68% | **+126%** |

Estos resultados se lograron haciendo TODO manualmente: revisando planillas, calculando frecuencias a mano, y contactando uno por uno. PymePilot automatiza este proceso completo.

---

## 2. Usuarios

### 2.1 Vendedor (usuario principal del dia a dia)

**Quien es:** Persona del equipo comercial que contacta clientes por WhatsApp/telefono.

**Que necesita:**
- Ver cada manana "a quien contactar hoy" con prioridad clara
- Mensaje sugerido listo para copiar y enviar
- Marcar como "contactado" o "ignorar" con un toque
- Funciona bien en celular (su herramienta principal)

**Frecuencia de uso:** Todos los dias laborales, primera hora de la manana.

### 2.2 Admin del Distribuidor

**Quien es:** Dueno, gerente comercial, o encargado del canal mayorista.

**Que necesita:**
- Ver KPIs de valor generado (cuanto facturamos gracias a PymePilot)
- Configurar que verticales estan activas
- Ver el estado de sincronizacion de datos con el ERP
- Gestionar acceso de su equipo

**Frecuencia de uso:** Semanal/quincenal para revisar metricas.

### 2.3 Viewer

**Quien es:** Gerente general o socio que quiere ver resultados sin operar.

**Que necesita:**
- Dashboards de KPIs
- Reportes exportables
- Vista de tendencias

**Frecuencia de uso:** Mensual.

### 2.4 Super Admin (Pato)

**Quien es:** Administrador del sistema completo (plataforma multi-tenant).

**Que necesita:**
- Crear y gestionar tenants (distribuidores)
- Monitorear salud del sistema
- Ver metricas de todos los tenants
- Configurar conectores ERP

**Frecuencia de uso:** Segun demanda.

---

## 3. Funcionalidades Core: Las 4 Verticales

PymePilot tiene 4 "verticales" de seguimiento. Cada una ataca un momento diferente del ciclo de vida del cliente.

```
CICLO DE VIDA DEL CLIENTE EN UN DISTRIBUIDOR B2B:

  [LEAD] --> [PRIMERA COMPRA] --> [RECURRENTE] --> [INACTIVO] --> [PERDIDO]
                    |                   |                |
                    V                   V                V
              VERTICAL 1          VERTICAL 2        VERTICAL 4
            (Activacion)       (Reposicion)      (Recuperacion)
                                    |
                                    V
                              VERTICAL 3
                             (Cross-Sell)
```

### 3.1 Vertical 2: Reposicion Predictiva (MVP)

**Prioridad:** MAXIMA — Es la primera que se construye porque tiene la mayor validacion con datos reales.

**Objetivo:** Contactar al cliente ANTES de que se quede sin stock, antes que la competencia.

**Como funciona:**
1. Analiza historial de compras de cada cliente (fechas, productos, cantidades)
2. Calcula la frecuencia de compra por producto/categoria (ej: "Juan compra fundas cada 28 dias")
3. Estima CUANDO va a necesitar reponer (ej: "proxima compra estimada: 25 de febrero")
4. 7 dias antes de la fecha estimada, genera una alerta con mensaje personalizado
5. El vendedor ve la alerta en el dashboard y contacta al cliente

**Datos de entrada:**
- Historial de ordenes de venta (del ERP)
- Clientes y sus datos de contacto
- Productos y categorias

**Datos de salida (prediccion):**
- Cliente a contactar
- Fecha recomendada de contacto
- Productos que necesita reponer (con cantidades estimadas)
- Mensaje personalizado generado por IA
- Score de confianza (que tan seguro estamos de la prediccion)
- Prioridad (1=alta, 5=baja)

**Metricas:**
- % de predicciones que resultan en compra
- Reduccion de dias entre compras
- Aumento del ticket promedio

### 3.2 Vertical 1: Activacion de Clientes Nuevos

**Prioridad:** Alta (se construye en Fase 5).

**Objetivo:** Convertir un cliente que hizo su primera compra en un cliente recurrente.

**Como funciona:**
1. Detecta automaticamente cuando un cliente hace su PRIMERA compra
2. Inicia una secuencia de seguimiento:
   - **Dia 7:** "Que tal te fue con el pedido? Necesitas algo mas?"
   - **Dia 15:** "Tenemos estos productos que complementan tu primera compra..."
   - **Dia 25:** "Muchos clientes como vos reponen en este momento. Queres que te reserve?"
3. Si el cliente compra de nuevo antes del dia 30, se "gradua" a recurrente
4. Si NO compra en 30 dias, genera alerta urgente

**Metricas:**
- % de conversion nuevos a recurrentes (objetivo: >50%)
- Tiempo promedio hasta segunda compra

### 3.3 Vertical 4: Recuperacion de Clientes Inactivos

**Prioridad:** Alta (se construye junto con V1 en Fase 5).

**Objetivo:** Reactivar clientes que dejaron de comprar antes de perderlos para siempre.

**Como funciona:**
1. Detecta clientes inactivos segun ventanas de tiempo:
   - **60 dias sin comprar:** Alerta temprana
   - **90 dias:** Alerta media
   - **120 dias:** Alerta critica
2. Calcula un score de probabilidad de recuperacion basado en:
   - Historial de compras previo (frecuencia, monto, antiguedad)
   - Patron de la ultima compra (fue inusualmente baja? compro menos productos?)
3. Genera mensajes escalonados segun nivel de urgencia:
   - 60 dias: Recordatorio amigable ("hace rato que no nos ves...")
   - 90 dias: Propuesta especial ("tenemos estos productos nuevos para vos...")
   - 120 dias: Ultimo intento ("queremos saber si hay algo que podamos mejorar...")

**Metricas:**
- % de inactivos recuperados por ventana
- Facturacion generada por clientes recuperados
- Reduccion de churn mensual (objetivo: <10%)

### 3.4 Vertical 3: Cross-Sell Inteligente

**Prioridad:** Media (se construye en Fase 7, requiere mas datos para funcionar bien).

**Objetivo:** Que clientes recurrentes compren MAS por pedido, agregando productos que nunca probaron.

**Como funciona:**
1. Analiza el catalogo completo del distribuidor
2. Para cada cliente, identifica:
   - Productos que NUNCA compro
   - De esos, cuales compran otros clientes con perfil similar
   - Cuales tienen mayor probabilidad de interes
3. Genera recomendacion: "Juan compra fundas y cargadores, pero nunca compro protectores de pantalla. El 72% de clientes que compran fundas tambien compran protectores."

**Metricas:**
- Nuevas categorias incorporadas por cliente
- Aumento del ticket promedio
- Tasa de aceptacion de recomendaciones

---

## 4. Ingesta de Datos (Pilar Fundamental)

La calidad del sistema depende 100% de la calidad y frescura de los datos. Sin datos actualizados, las predicciones no sirven.

### 4.1 Arquitectura de Conectores

PymePilot usa una **arquitectura de plugins** para ingesta de datos. Esto significa que cada fuente de datos (ERP, Excel, etc.) tiene su propio "conector" que traduce los datos al formato que PymePilot entiende.

```
[Contabilium API] ---> [ContabiliumConnector] ---+
                                                  |
[Excel/CSV]       ---> [ExcelConnector]      ---+--> [Formato Interno] --> [PostgreSQL]
                                                  |
[Futuro: Xubio]   ---> [XubioConnector]     ---+
```

**Ventaja:** Para agregar un nuevo ERP, solo hay que crear un nuevo conector. El resto del sistema (motor de predicciones, dashboard, etc.) no cambia.

### 4.2 Primer Conector: Contabilium

- **Tipo:** API REST (JSON)
- **Frecuencia de sync:** Diaria (5:00 AM Argentina)
- **Datos que se sincronizan:**
  - Clientes (nombre, contacto, datos fiscales)
  - Productos (nombre, SKU, categoria, precio)
  - Ordenes de venta (fecha, cliente, productos, cantidades, montos)
- **Requisito del cliente:** Plan Full de Contabilium (incluye acceso API)

### 4.3 Conector Fallback: Excel/CSV

Para clientes que no tienen ERP o prefieren cargar datos manualmente:
- Upload de archivo Excel (.xlsx) o CSV
- Formato estandarizado con columnas requeridas
- Validacion automatica antes de importar
- Mensajes de error claros si algo falta o esta mal formateado

### 4.4 Conectores Futuros

ERPs populares en el mercado mayorista argentino a considerar:
- Xubio
- Alegra
- Colppy
- Sistemas propios / bases de datos ad-hoc

---

## 5. Lo que NO es PymePilot

Es importante definir que NO hace PymePilot para mantener el foco:

- **No es un CRM** — No reemplaza Kommo, Salesforce ni HubSpot. Los complementa dandoles inteligencia sobre a quien contactar.
- **No es un ERP** — No gestiona facturacion, stock, logistica ni contabilidad. LEE datos del ERP, no los modifica.
- **No es un chatbot** — No responde mensajes automaticamente. Sugiere mensajes que el vendedor revisa y envia manualmente.
- **No envia mensajes sin aprobacion** — En el MVP, todo mensaje pasa por el vendedor antes de ser enviado.
- **No funciona sin historial** — Necesita al menos 3 meses de datos de compras para generar predicciones confiables.
- **No gestiona pagos ni cobros** — No procesa transacciones financieras.

---

## 6. Metricas de Exito

### 6.1 MVP (Hito Semana 9)

| Metrica | Criterio de exito |
|---|---|
| Sync automatico | Datos de IEY se sincronizan desde Contabilium sin intervencion manual |
| Predicciones generadas | Motor genera predicciones para al menos 10 clientes de IEY |
| Usabilidad | Vendedor puede ver lista y copiar mensajes desde el celular |
| Precision | Al menos 50% de predicciones confirmadas como utiles por equipo IEY |
| Flujo completo | ERP -> sync -> prediccion -> mensaje -> dashboard funciona end-to-end |

### 6.2 Plataforma (6 meses)

| Metrica | Criterio de exito |
|---|---|
| Tenants | 2+ distribuidores operativos |
| Churn | Reduccion medible de clientes perdidos en cada tenant |
| Facturacion | Incremento medible de facturacion recurrente |
| Onboarding | < 1 dia para activar nuevo distribuidor |
| Verticales | Al menos 3 de 4 verticales operativas |

---

## 7. Requisitos Tecnicos

### 7.1 Stack

| Componente | Tecnologia | Razon |
|---|---|---|
| Frontend | Next.js 14+ (App Router) + TypeScript + Tailwind + shadcn/ui | Performance, SEO, componentes modernos |
| Base de datos | PostgreSQL 15 (via Supabase self-hosted) | Ya corriendo en produccion, RLS nativo |
| Auth | Supabase GoTrue | Multi-tenant con tenant_id en JWT |
| Motor IA | Python 3.11+ + Anthropic Claude API | Analisis de datos + generacion de mensajes |
| Conectores | Python (requests + pandas) | Flexibilidad para diferentes ERPs |
| Deploy | Docker en Contabo VPS | Ya configurado con Traefik SSL |

### 7.2 Multi-Tenant

- Cada distribuidor es un "tenant" (inquilino) aislado
- Todos los datos en las mismas tablas pero con `tenant_id` en cada fila
- Row Level Security (RLS) garantiza que un tenant NUNCA vea datos de otro
- Cada tenant puede tener su propio tipo de ERP y configuracion

### 7.3 Seguridad

- Autenticacion obligatoria para todas las rutas
- RLS en TODAS las tablas con datos de tenant
- Secrets en variables de entorno (nunca en codigo)
- Backups automaticos diarios (ya configurados)
- Testing de aislamiento entre tenants antes de cada release

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigacion |
|---|---|---|---|
| API de Contabilium con limitaciones no documentadas | Media | Alto | Investigar a fondo antes de implementar, tener Excel como fallback |
| Claude API costosa a escala | Media | Medio | Usar Claude Sonnet (mas barato), prompt caching, limitar tokens |
| Predicciones de baja calidad | Media | Alto | Validar manualmente con IEY, iterar prompts, calcular precision |
| Supabase self-hosted requiere mantenimiento | Baja | Medio | Backups diarios, monitoreo con Grafana, documentar operaciones |
| Clientes no exportan datos correctamente | Alta | Medio | Conector ERP automatico (no depende del cliente), validacion de datos |
| Competencia con herramientas similares | Baja | Medio | Foco en nicho B2B mayorista argentino, ventaja de validacion real |

---

## 9. Dependencias Externas

| Dependencia | Tipo | Riesgo |
|---|---|---|
| Contabilium API | Critica para MVP | Investigar limites y disponibilidad |
| Anthropic Claude API | Critica para motor | Tener modelo fallback (Sonnet -> Haiku) |
| Kommo CRM API | Para Fase 6 | No bloquea MVP, deep link como fallback |
| Supabase stack (Docker) | Infraestructura base | Ya corriendo y estable |

---

## Apendice: Glosario

| Termino | Significado |
|---|---|
| **Tenant** | Un distribuidor/cliente que usa PymePilot. Cada tenant tiene sus datos aislados. |
| **Vertical** | Un tipo de seguimiento/analisis especifico (Activacion, Reposicion, Cross-Sell, Recuperacion). |
| **Prediccion** | Una recomendacion generada por el motor: "contacta a X, ofrecele Y, porque Z". |
| **Sync** | El proceso de sincronizar datos del ERP del cliente con la base de datos de PymePilot. |
| **Conector** | Un plugin que se conecta a un ERP especifico y traduce sus datos al formato de PymePilot. |
| **RLS** | Row Level Security. Mecanismo de PostgreSQL que filtra datos por tenant automaticamente. |
| **ERP** | Enterprise Resource Planning. Sistema de gestion (facturacion, stock, etc.) que usa el distribuidor. |
| **Churn** | Tasa de perdida de clientes. % de clientes que dejan de comprar en un periodo. |
| **Cross-Sell** | Vender productos adicionales/complementarios a un cliente existente. |
| **Score de confianza** | Numero de 0 a 1 que indica que tan seguro esta el motor de una prediccion. |
