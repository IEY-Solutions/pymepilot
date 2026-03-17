\# Skill: Prompt Engineering para Verticales

\#\# 🎯 Qué es  
Técnicas de prompt engineering específicas para PymePilot. Optimizar prompts para generar mensajes de WhatsApp efectivos, cortos, y personalizados.

\*\*Por qué es CRÍTICO:\*\*  
\- Prompt malo \= mensaje genérico sin valor  
\- Prompt bueno \= mensaje persuasivo que convierte  
\- Optimización \= menos tokens \= menos costo

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Estructura de Prompt  
\`\`\`  
1\. ROL (quién es Claude)  
2\. TAREA (qué debe hacer)  
3\. CONTEXTO (información del customer)  
4\. RESTRICCIONES (límites claros)  
5\. EJEMPLOS (few-shot learning)  
6\. OUTPUT (qué generar)  
\`\`\`

\*\*Ejemplo:\*\*  
\`\`\`python  
prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es generar un mensaje de WhatsApp para reactivar un cliente inactivo.

CONTEXTO DEL CLIENTE:  
\- Nombre: {customer\['name'\]}  
\- Última compra: hace {days} días  
\- Productos favoritos: {products}

RESTRICCIONES:  
\- Máximo 50 palabras  
\- Sin emojis  
\- Sin markdown  
\- Tono: amigable pero profesional

EJEMPLO BUENO:  
"Hola Juan\! Hace tiempo que no te vemos. Tenemos stock nuevo de fundas MagSafe. Te pasamos el catálogo?"

GENERÁ EL MENSAJE:"""  
\`\`\`

\#\#\# Práctica 2: Optimización de Tokens  
\`\`\`python  
\# ❌ MAL \- Muy verbose (muchos tokens)  
prompt \= """You are a highly skilled sales assistant working for a wholesale   
distributor in Argentina. Your job is to carefully analyze the customer data   
and generate a personalized WhatsApp message that will effectively reactivate   
inactive customers by appealing to their previous purchase history..."""

\# ✅ BIEN \- Conciso (menos tokens)  
prompt \= """Sos asistente de ventas B2B en Argentina.  
Generá mensaje WhatsApp para reactivar cliente inactivo.

Cliente: {name}  
Última compra: hace {days} días  
Productos: {products}

Mensaje (máx 50 palabras, sin emojis):"""  
\`\`\`

\#\#\# Práctica 3: Few-Shot Learning  
\`\`\`python  
\# Incluir 1-2 ejemplos buenos  
prompt \= f"""EJEMPLOS:

Cliente: Juan, 45 días inactivo, compraba fundas iPhone  
Mensaje: "Hola Juan\! Hace tiempo que no te vemos. Tenemos stock nuevo de fundas iPhone 15\. Te paso el catálogo?"

Cliente: María, 60 días inactiva, compraba cables USB-C  
Mensaje: "Hola María\! Llegaron cables USB-C reforzados que te gustaban. Querés que te mandemos lista de precios?"

AHORA GENERÁ PARA:  
Cliente: {customer\['name'\]}, {days} días inactivo, compraba {products}  
Mensaje:"""  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Rol claro  
\- \[ \] Tarea específica  
\- \[ \] Contexto mínimo necesario  
\- \[ \] Restricciones explícitas  
\- \[ \] 1-2 ejemplos (few-shot)  
\- \[ \] Output format definido  
\- \[ \] \<1000 tokens input

\---  
