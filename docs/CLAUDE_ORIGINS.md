# CLAUDE.md — Origenes de cada regla

> Este archivo contiene el contexto historico de por que existe cada regla
> en CLAUDE.md. Fue extraido para mantener CLAUDE.md dentro del limite de
> 32 KB requerido por Codex. Referencia: `docs/CLAUDE_ORIGINS.md`

---

## CONTEXT7 MCP — USO PROACTIVO OBLIGATORIO

> **Origen:** Sesion 2026-02-23. Se instalo el MCP de Context7 para consultar
> documentacion actualizada de cualquier libreria directamente desde Claude Code.
> El objetivo es que Claude use documentacion real y vigente en vez de confiar
> solo en su conocimiento interno (que puede estar desactualizado o incompleto).

---

## SKILL DE BRAINSTORMING — USO PROACTIVO OBLIGATORIO

> **Origen:** Sesion 2026-02-23. Pato quiere que toda solicitud creativa
> pase por un proceso de exploracion estructurada ANTES de implementar.
> El objetivo es evitar que Claude salte directo a codear sin entender
> bien la intencion, explorar alternativas, y alinear expectativas.

---

## REGLA MADRE 1 — NO EVALUAR SI UN PROTOCOLO APLICA

> **Origen:** Sesion 2026-02-25. Analisis post-auditoria revelo que 3 de 5
> errores de la sesion tuvieron la misma raiz: Claude evaluo internamente
> si el protocolo "tenia sentido" en ese caso especifico, decidio que no,
> y lo salteo. La Regla de las Dos Opciones se salteo porque "es un fix
> obvio". Context7 se salteo porque "ya se como funciona". La Definicion
> de Terminado se salteo porque "es un paso intermedio, no un entregable".
> En los 3 casos, la regla decia "siempre" y Claude le invento una
> excepcion que no existia.

---

## REGLA MADRE 2 — ANTE CONFLICTO, CLAUDE.MD GANA SOBRE CONCISION

> **Origen:** Sesion 2026-02-25. Analisis post-auditoria revelo que 2 de 5
> errores ocurrieron porque instrucciones base del sistema ("be concise",
> "keep it brief") compitieron con protocolos de CLAUDE.md (modo educativo,
> gestion de contexto) y la concision gano por default. CLAUDE.md ya dice
> "OVERRIDE any default behavior", pero en la practica ese override se
> procesa como declarativo, no operativo.

---

## PUNTO CIEGO ESTRUCTURAL

> **Origen de esta ampliacion:** Sesion 2026-02-23. Se intento COPY
> .env.local dentro de un Dockerfile mientras se "arreglaba el build".
> La regla original decia "antes de disenar". Como el contexto mental
> era "arreglando", el checkpoint no se activo. La accion era peligrosa
> independientemente de la intencion.

---

## DEFINICION DE TERMINADO — SESGO DE SCOPE REDUCIDO

> **Origen:** Sesion 2026-02-24. Tres errores con la misma raiz:
> (1) SmartFileConnector con IDs secuenciales que se pisan entre uploads
> — se optimizo para "que funcione el primer upload" sin considerar el
> segundo. (2) Canal 2 declarado completo sin revisar el design doc
> multi-canal que lo contenia — el scope de "terminado" fue la tarea
> inmediata, no el plan que la origino. (3) WhatsApp API presentado
> como opcion viable sin verificar que Pato no tenia proveedor — la
> opcion se evaluo por completitud del brainstorming, no por viabilidad
> real.
>
> **Patron comun:** Claude construye una definicion de "terminado" al
> inicio de la tarea y despues no la cuestiona. Esa definicion tiende
> a ser mas chica que la realidad porque excluye lo que esta fuera del
> campo de vision inmediato: usos futuros, documentos padre, y
> dependencias externas no tecnicas.

---

## PROTOCOLO POST-MODIFICACION DE CODIGO (OBLIGATORIO)

> **Origen:** Sesion 2026-02-22. Durante debugging en vivo se parchearon 5 bugs
> sin verificacion cruzada entre archivos. Funciono por suerte, no por protocolo.
> Pato: "30 segundos mas por output nos sale mas barato que ir rompiendo cosas."

---

## DECLARACION DE INCERTIDUMBRE

> **Origen:** Sesion 2026-02-22. No se menciono el riesgo de Cloudflare al disenar
> la conexion al ERP, a pesar de ser un problema conocido con VPS de datacenter.
> El sesgo natural es presentar todo como seguro. Esta regla fuerza honestidad.

---

## ANTI-DEGRADACION POR CONTEXTO LARGO

> **Origen:** Sesion 2026-02-22. Los primeros pasos de implementacion fueron
> mas cuidadosos que los ultimos. Los bugfixes finales se parchearon sin
> revision cruzada. La calidad se degradó hacia el final de la sesion.

---

## REGLA DE LAS DOS OPCIONES

> **Origen:** Sesion 2026-02-22. Cuando Cloudflare bloqueo la API, se invirtio
> tiempo debuggeando la conexion en vez de proponer inmediatamente el camino
> alternativo (Excel) que ya estaba listo. Primera solucion ≠ mejor solucion.

> **Origen de este filtro:** Sesion 2026-02-23. Se presento como
> "Opcion A Recomendada" usar una string literal `${ANON_KEY}` como
> API key de Kong — un hack inseguro disfrazado de pragmatismo.
> Pato eligio la opcion correcta (generar JWTs reales). El sesgo
> natural es presentar "lo rapido" como recomendado. Este filtro
> obliga a que ambas opciones sean seguras antes de presentarlas.

---

## VERIFICACION DE ENTORNO ANTES DE INSTRUCCIONES MANUALES

> **Origen:** Sesion 2026-02-22. Se dieron comandos curl con sintaxis Bash
> cuando Pato estaba en PowerShell (Windows). 4 intentos fallidos desperdiciados.

---

## CHECKLIST DE RIESGOS PARA CONEXIONES EXTERNAS

> **Origen:** Sesion 2026-02-22. No se anticipo que Cloudflare bloquearia
> la IP del VPS (173.249.9.56) al conectar con Contabilium. Es un problema
> conocido con VPS de datacenter que debia haberse listado como riesgo.

---

## CONTROL DE COSTOS CLAUDE API — PRIORIDAD MAXIMA

> **Origen:** Fase 2 (2026-02-22). La API de Claude es un recurso de pago
> que se conecta directamente a la billetera del proyecto. Cada token
> consumido es dinero real. El sistema DEBE ser implacable en el control
> de costos: prevenir, medir, alertar, y bloquear antes de que un error
> de codigo o un loop infinito genere una factura inesperada.
