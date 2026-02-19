---
name: claude-api-integration
description: Cliente Anthropic SDK completo con retry logic y token tracking
---

\# Skill: Claude API Integration

\#\# 🎯 Qué es  
Guía completa para integrar Claude API (Anthropic) en PymePilot. Cubre desde configuración del SDK hasta prompting avanzado, error handling, streaming, y optimización de costos.

\*\*Analogía Simple:\*\*  
Claude API es como contratar un escritor experto freelance:  
\- Le das instrucciones (prompt)  
\- Él escribe el contenido (completion)  
\- Pagas por palabra escrita (tokens)  
\- Puedes pedirle que revise (extended thinking)  
\- Puedes reusar contexto (prompt caching)

En PymePilot:  
\- Prompt \= contexto del customer \+ instrucciones de vertical  
\- Completion \= mensaje de WhatsApp personalizado  
\- Tokens \= costo real del servicio  
\- Extended thinking \= análisis profundo antes de responder

\*\*Por qué es CRÍTICO:\*\*  
\- Claude genera TODOS los mensajes personalizados  
\- Costos pueden crecer rápido si no optimizamos  
\- Calidad del prompt \= calidad del mensaje  
\- Error handling evita perder dinero en requests fallidos

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al implementar verticales nuevas  
\- ✅ Al modificar prompts existentes  
\- ✅ Al detectar mensajes de baja calidad  
\- ✅ Al optimizar costos de API

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Costos de Claude suben \>$50/mes  
\- ⚠️ Latencia de API \>5 segundos  
\- ⚠️ Rate limits alcanzados  
\- ⚠️ Necesitás razonamiento complejo (extended thinking)

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Setup del Cliente

\*\*Instalación:\*\*  
\`\`\`bash  
pip install anthropic \--break-system-packages  
\`\`\`

\*\*Configuración básica:\*\*  
\`\`\`python  
\# engine/claude/client.py  
import os  
from anthropic import Anthropic, APIError, RateLimitError  
import logging

logger \= logging.getLogger(\_\_name\_\_)

class ClaudeClient:  
    """Cliente de Claude API con retry logic y logging."""  
      
    def \_\_init\_\_(self):  
        self.api\_key \= os.getenv('ANTHROPIC\_API\_KEY')  
          
        if not self.api\_key:  
            raise ValueError('ANTHROPIC\_API\_KEY not set in environment')  
          
        self.client \= Anthropic(api\_key=self.api\_key)  
        self.model \= 'claude-sonnet-4-20250514'  \# Modelo por defecto  
        self.max\_retries \= 3  
        self.timeout \= 30.0  \# segundos  
      
    def generate\_message(  
        self,  
        prompt: str,  
        max\_tokens: int \= 300,  
        temperature: float \= 1.0,  
        use\_extended\_thinking: bool \= False  
    ) \-\> dict:  
        """  
        Generar mensaje con Claude API.  
          
        Args:  
            prompt: Prompt completo con contexto  
            max\_tokens: Máximo de tokens en completion  
            temperature: 0.0-1.0 (más alto \= más creativo)  
            use\_extended\_thinking: Usar razonamiento extendido  
          
        Returns:  
            dict con: text, usage (tokens), thinking (si aplica)  
          
        Raises:  
            ValueError: Si prompt inválido  
            APIError: Si Claude API falla después de retries  
        """  
        if not prompt or len(prompt) \< 10:  
            raise ValueError('Prompt too short')  
          
        for attempt in range(1, self.max\_retries \+ 1):  
            try:  
                logger.info(  
                    f"Claude API request (attempt {attempt}/{self.max\_retries})",  
                    extra={  
                        'prompt\_length': len(prompt),  
                        'max\_tokens': max\_tokens,  
                        'extended\_thinking': use\_extended\_thinking  
                    }  
                )  
                  
                \# Configurar thinking si es necesario  
                if use\_extended\_thinking:  
                    response \= self.client.messages.create(  
                        model=self.model,  
                        max\_tokens=max\_tokens,  
                        thinking={  
                            'type': 'enabled',  
                            'budget\_tokens': 1000  \# Tokens para pensar  
                        },  
                        messages=\[{  
                            'role': 'user',  
                            'content': prompt  
                        }\],  
                        temperature=temperature  
                    )  
                else:  
                    response \= self.client.messages.create(  
                        model=self.model,  
                        max\_tokens=max\_tokens,  
                        messages=\[{  
                            'role': 'user',  
                            'content': prompt  
                        }\],  
                        temperature=temperature  
                    )  
                  
                \# Extraer texto de respuesta  
                text\_content \= ''  
                thinking\_content \= ''  
                  
                for block in response.content:  
                    if block.type \== 'text':  
                        text\_content \+= block.text  
                    elif block.type \== 'thinking':  
                        thinking\_content \+= block.thinking  
                  
                \# Log de tokens usados  
                logger.info(  
                    'Claude API success',  
                    extra={  
                        'input\_tokens': response.usage.input\_tokens,  
                        'output\_tokens': response.usage.output\_tokens,  
                        'total\_tokens': response.usage.input\_tokens \+ response.usage.output\_tokens,  
                        'model': self.model  
                    }  
                )  
                  
                return {  
                    'text': text\_content,  
                    'thinking': thinking\_content if use\_extended\_thinking else None,  
                    'usage': {  
                        'input\_tokens': response.usage.input\_tokens,  
                        'output\_tokens': response.usage.output\_tokens,  
                        'total\_tokens': response.usage.input\_tokens \+ response.usage.output\_tokens  
                    },  
                    'model': self.model  
                }  
                  
            except RateLimitError as e:  
                logger.warning(  
                    f'Rate limit hit (attempt {attempt}/{self.max\_retries})',  
                    extra={'error': str(e)}  
                )  
                  
                if attempt \< self.max\_retries:  
                    \# Exponential backoff: 2s, 4s, 8s  
                    wait\_time \= 2 \*\* attempt  
                    logger.info(f'Waiting {wait\_time}s before retry...')  
                    import time  
                    time.sleep(wait\_time)  
                else:  
                    raise  
              
            except APIError as e:  
                logger.error(  
                    f'Claude API error (attempt {attempt}/{self.max\_retries})',  
                    extra={'error': str(e), 'status\_code': e.status\_code}  
                )  
                  
                \# Solo retry en errores transitorios (5xx)  
                if e.status\_code \>= 500 and attempt \< self.max\_retries:  
                    import time  
                    time.sleep(2 \*\* attempt)  
                else:  
                    raise  
              
            except Exception as e:  
                logger.error('Unexpected error in Claude API', exc\_info=True)  
                raise  
          
        raise APIError('Max retries exceeded')

\# Singleton instance  
\_claude\_client \= None

def get\_claude\_client() \-\> ClaudeClient:  
    """Obtener instancia singleton del cliente."""  
    global \_claude\_client  
    if \_claude\_client is None:  
        \_claude\_client \= ClaudeClient()  
    return \_claude\_client  
\`\`\`

\#\#\# Práctica 2: Prompt Engineering para Verticales

\*\*Template de prompt (Vertical Activación):\*\*  
\`\`\`python  
\# engine/claude/prompts.py  
from typing import Dict, Any

def build\_activation\_prompt(customer: Dict\[str, Any\], top\_products: list\[str\]) \-\> str:  
    """  
    Construir prompt para Vertical de Activación.  
      
    Args:  
        customer: Dict con name, last\_purchase\_date, total\_purchases  
        top\_products: Lista de nombres de productos más comprados  
      
    Returns:  
        Prompt completo para Claude  
    """  
      
    \# Calcular días inactivo  
    from datetime import datetime  
    last\_purchase \= datetime.fromisoformat(customer\['last\_purchase\_date'\])  
    days\_inactive \= (datetime.now() \- last\_purchase).days  
      
    prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es generar un mensaje de WhatsApp corto y efectivo para reactivar un cliente inactivo.

INFORMACIÓN DEL CLIENTE:  
\- Nombre: {customer\['name'\]}  
\- Última compra: hace {days\_inactive} días  
\- Total comprado históricamente: ${customer\['total\_purchases'\]:,.2f}  
\- Productos que más compró: {', '.join(top\_products\[:3\]) if top\_products else 'No disponible'}

INSTRUCCIONES:  
1\. Generá un mensaje de máximo 3 líneas (50 palabras)  
2\. Tono: amigable, directo, profesional  
3\. Mencioná al cliente por nombre  
4\. Hacé referencia a productos que compraba  
5\. Incluí un llamado a la acción claro (ejemplo: "Te pasamos el catálogo actualizado?")  
6\. NO uses emojis  
7\. NO uses markdown (nada de \*\* o \_\_)  
8\. NO uses saludos formales excesivos

EJEMPLO DE BUEN MENSAJE:  
"Hola Juan\! Hace tiempo que no te vemos. Tenemos novedades en fundas MagSafe que te encantaban. Te pasamos el catálogo actualizado?"

GENERÁ EL MENSAJE:"""

    return prompt

def build\_restock\_prompt(customer: Dict\[str, Any\], products\_low\_stock: list\[Dict\]) \-\> str:  
    """Prompt para Vertical de Reposición."""  
      
    products\_text \= '\\n'.join(\[  
        f"- {p\['name'\]}: última compra hace {p\['days\_since\_purchase'\]} días, promedio cada {p\['avg\_days\_between\_purchases'\]} días"  
        for p in products\_low\_stock\[:3\]  
    \])  
      
    prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es generar un mensaje de WhatsApp sugiriendo reposición de stock.

INFORMACIÓN DEL CLIENTE:  
\- Nombre: {customer\['name'\]}

PRODUCTOS QUE PODRÍA NECESITAR REPONER:  
{products\_text}

INSTRUCCIONES:  
1\. Mensaje de máximo 3 líneas (50 palabras)  
2\. Tono: útil, no invasivo  
3\. Mencioná 1-2 productos específicos  
4\. Sugerí que podría necesitar restock pronto  
5\. Llamado a la acción: ofrecer presupuesto rápido  
6\. NO uses emojis ni markdown

GENERÁ EL MENSAJE:"""

    return prompt

def build\_cross\_sell\_prompt(customer: Dict\[str, Any\], recommended\_products: list\[str\]) \-\> str:  
    """Prompt para Vertical de Cross-Sell."""  
      
    prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es sugerir productos complementarios.

INFORMACIÓN DEL CLIENTE:  
\- Nombre: {customer\['name'\]}  
\- Compra frecuentemente: {customer.get('frequent\_category', 'varios productos')}

PRODUCTOS COMPLEMENTARIOS RECOMENDADOS:  
{', '.join(recommended\_products\[:3\])}

INSTRUCCIONES:  
1\. Mensaje de máximo 3 líneas (50 palabras)  
2\. Conectá productos que ya compra con los recomendados  
3\. Explicá brevemente por qué estos productos complementan  
4\. Tono: consultivo, no agresivo  
5\. NO uses emojis ni markdown

GENERÁ EL MENSAJE:"""

    return prompt  
\`\`\`

\#\#\# Práctica 3: Optimización de Costos

\*\*Prompt Caching (reutilizar contexto):\*\*  
\`\`\`python  
def generate\_with\_caching(customer\_data: dict) \-\> str:  
    """  
    Usar prompt caching para contexto repetido.  
      
    Útil cuando generás múltiples mensajes con mismo contexto base.  
    """  
      
    \# Contexto que NO cambia (cacheable)  
    system\_context \= """Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

REGLAS GENERALES:  
\- Mensajes de máximo 50 palabras  
\- Tono amigable y profesional  
\- Sin emojis ni markdown  
\- Llamado a la acción claro  
\- Mencionar cliente por nombre

CARACTERÍSTICAS DEL MERCADO:  
\- B2B mayorista (no retail)  
\- Volúmenes grandes (cajas, pallets)  
\- Clientes valoran rapidez y precio  
\- Relaciones a largo plazo"""  
      
    \# Contexto específico del customer (cambia)  
    user\_prompt \= f"""Cliente: {customer\_data\['name'\]}  
Situación: {customer\_data\['situation'\]}  
Generá mensaje de activación."""  
      
    response \= client.messages.create(  
        model='claude-sonnet-4-20250514',  
        max\_tokens=200,  
        system=\[{  
            'type': 'text',  
            'text': system\_context,  
            'cache\_control': {'type': 'ephemeral'}  \# ← Cachea esto  
        }\],  
        messages=\[{  
            'role': 'user',  
            'content': user\_prompt  
        }\]  
    )  
      
    \# Verificar cache usage  
    if hasattr(response.usage, 'cache\_creation\_input\_tokens'):  
        logger.info(f"Cache created: {response.usage.cache\_creation\_input\_tokens} tokens")  
    if hasattr(response.usage, 'cache\_read\_input\_tokens'):  
        logger.info(f"Cache hit: {response.usage.cache\_read\_input\_tokens} tokens")  
      
    return response.content\[0\].text  
\`\`\`

\*\*Batching (procesar múltiples en una request):\*\*  
\`\`\`python  
def generate\_batch\_messages(customers: list\[dict\]) \-\> list\[str\]:  
    """  
    Generar múltiples mensajes en una sola request.  
      
    Más eficiente que 1 request por customer.  
    """  
      
    \# Construir prompt con múltiples customers  
    customers\_text \= '\\n\\n'.join(\[  
        f"CLIENTE {i+1}:\\n"  
        f"- Nombre: {c\['name'\]}\\n"  
        f"- Situación: {c\['situation'\]}\\n"  
        f"- Productos: {', '.join(c\['products'\])}"  
        for i, c in enumerate(customers\[:5\])  \# Máx 5 por batch  
    \])  
      
    prompt \= f"""Generá un mensaje de WhatsApp para CADA uno de estos clientes:

{customers\_text}

Formato de respuesta:  
MENSAJE\_1: \[mensaje para cliente 1\]  
MENSAJE\_2: \[mensaje para cliente 2\]  
...

Recordá: máximo 50 palabras por mensaje, sin emojis."""  
      
    response \= client.messages.create(  
        model='claude-sonnet-4-20250514',  
        max\_tokens=1000,  \# Más tokens para múltiples mensajes  
        messages=\[{'role': 'user', 'content': prompt}\]  
    )  
      
    \# Parsear respuesta  
    text \= response.content\[0\].text  
    messages \= \[\]  
      
    for i in range(len(customers)):  
        pattern \= f'MENSAJE\_{i+1}: (.+?)(?=MENSAJE\_|$)'  
        import re  
        match \= re.search(pattern, text, re.DOTALL)  
        if match:  
            messages.append(match.group(1).strip())  
      
    return messages  
\`\`\`

\#\#\# Práctica 4: Extended Thinking (Razonamiento Profundo)

\*\*Cuándo usar extended thinking:\*\*  
\`\`\`python  
def generate\_with\_thinking(customer: dict, complexity: str \= 'simple') \-\> dict:  
    """  
    Usar extended thinking para casos complejos.  
      
    Args:  
        customer: Datos del customer  
        complexity: 'simple' o 'complex'  
      
    Returns:  
        dict con 'message' y 'reasoning'  
    """  
      
    use\_thinking \= complexity \== 'complex'  
      
    prompt \= f"""Analizá este customer y decidí la mejor estrategia de contacto.

CUSTOMER:  
\- Nombre: {customer\['name'\]}  
\- Último pedido: hace {customer\['days\_inactive'\]} días  
\- Historial: {customer\['order\_count'\]} pedidos, ${customer\['total\_spent'\]:,.2f}  
\- Categorías: {', '.join(customer\['categories'\])}  
\- Tendencia: {'creciente' if customer\['growing'\] else 'decreciente'}

TAREA:  
1\. Analizá el perfil del customer  
2\. Decidí qué estrategia usar (activación, cross-sell, o no contactar)  
3\. Si corresponde contactar, generá el mensaje (máx 50 palabras)

RESPUESTA:"""  
      
    response \= get\_claude\_client().generate\_message(  
        prompt=prompt,  
        max\_tokens=500 if use\_thinking else 300,  
        use\_extended\_thinking=use\_thinking  
    )  
      
    return {  
        'message': response\['text'\],  
        'reasoning': response\['thinking'\],  \# None si no usó thinking  
        'usage': response\['usage'\]  
    }

\# Ejemplo de uso  
customer\_complex \= {  
    'name': 'Distribuidora XYZ',  
    'days\_inactive': 45,  
    'order\_count': 127,  
    'total\_spent': 5\_430\_000,  
    'categories': \['Accesorios', 'Cables', 'Cargadores'\],  
    'growing': False  
}

result \= generate\_with\_thinking(customer\_complex, complexity='complex')

print("Razonamiento de Claude:")  
print(result\['reasoning'\])  
print("\\nMensaje generado:")  
print(result\['message'\])  
\`\`\`

\#\#\# Práctica 5: Streaming (para UI en tiempo real)  
\`\`\`python  
import anthropic

def generate\_streaming(prompt: str):  
    """  
    Generar respuesta con streaming.  
      
    Útil para mostrar progreso en UI.  
    """  
      
    client \= anthropic.Anthropic(api\_key=os.getenv('ANTHROPIC\_API\_KEY'))  
      
    full\_text \= ''  
      
    with client.messages.stream(  
        model='claude-sonnet-4-20250514',  
        max\_tokens=300,  
        messages=\[{'role': 'user', 'content': prompt}\]  
    ) as stream:  
        for text in stream.text\_stream:  
            print(text, end='', flush=True)  \# Imprimir en tiempo real  
            full\_text \+= text  
      
    \# Al final, obtener metadata  
    final\_message \= stream.get\_final\_message()  
      
    return {  
        'text': full\_text,  
        'usage': {  
            'input\_tokens': final\_message.usage.input\_tokens,  
            'output\_tokens': final\_message.usage.output\_tokens  
        }  
    }  
\`\`\`

\---

\#\# 💻 Ejemplos de Código

\#\#\# Ejemplo 1: Vertical Activación Completa  
\`\`\`python  
\# engine/verticales/activacion.py  
from typing import List, Dict  
from uuid import UUID  
import logging

from engine.claude.client import get\_claude\_client  
from engine.claude.prompts import build\_activation\_prompt  
from engine.db.queries import (  
    get\_inactive\_customers,  
    get\_customer\_top\_products,  
    save\_prediction  
)

logger \= logging.getLogger(\_\_name\_\_)

class VerticalActivacion:  
    """Vertical para reactivar clientes inactivos."""  
      
    def \_\_init\_\_(self):  
        self.claude \= get\_claude\_client()  
        self.days\_inactive\_threshold \= 90  
      
    def run(self, tenant\_id: UUID, limit: int \= 50\) \-\> List\[Dict\]:  
        """  
        Ejecutar vertical de activación.  
          
        Args:  
            tenant\_id: UUID del tenant  
            limit: Máximo de customers a procesar  
          
        Returns:  
            Lista de predictions generadas  
        """  
        logger.info(  
            f"Running Activacion vertical for tenant {tenant\_id}",  
            extra={'tenant\_id': str(tenant\_id), 'limit': limit}  
        )  
          
        \# 1\. Obtener customers inactivos  
        customers \= get\_inactive\_customers(  
            tenant\_id=tenant\_id,  
            days\_inactive=self.days\_inactive\_threshold,  
            limit=limit  
        )  
          
        logger.info(f"Found {len(customers)} inactive customers")  
          
        predictions \= \[\]  
          
        \# 2\. Procesar cada customer  
        for customer in customers:  
            try:  
                \# Obtener top productos  
                top\_products \= get\_customer\_top\_products(  
                    customer\_id=customer\['id'\],  
                    tenant\_id=tenant\_id,  
                    limit=5  
                )  
                  
                \# Construir prompt  
                prompt \= build\_activation\_prompt(customer, top\_products)  
                  
                \# Generar mensaje con Claude  
                response \= self.claude.generate\_message(  
                    prompt=prompt,  
                    max\_tokens=200,  
                    temperature=0.7  \# Un poco de creatividad  
                )  
                  
                \# Guardar prediction  
                prediction \= save\_prediction(  
                    tenant\_id=tenant\_id,  
                    customer\_id=customer\['id'\],  
                    vertical='activacion',  
                    message\_text=response\['text'\],  
                    confidence\_score=0.85,  \# Placeholder  
                    claude\_model=response\['model'\],  
                    prompt\_tokens=response\['usage'\]\['input\_tokens'\],  
                    completion\_tokens=response\['usage'\]\['output\_tokens'\]  
                )  
                  
                predictions.append(prediction)  
                  
                logger.info(  
                    f"Generated prediction for customer {customer\['id'\]}",  
                    extra={  
                        'customer\_id': str(customer\['id'\]),  
                        'tokens': response\['usage'\]\['total\_tokens'\]  
                    }  
                )  
                  
            except Exception as e:  
                logger.error(  
                    f"Failed to generate prediction for customer {customer\['id'\]}",  
                    exc\_info=True,  
                    extra={'customer\_id': str(customer\['id'\])}  
                )  
                \# Continuar con el siguiente  
                continue  
          
        logger.info(  
            f"Activacion vertical completed",  
            extra={  
                'predictions\_generated': len(predictions),  
                'customers\_processed': len(customers)  
            }  
        )  
          
        return predictions  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: API key hardcodeada  
\`\`\`python  
\# ❌ MAL  
client \= Anthropic(api\_key='sk-ant-api03-abc123...')

\# ✅ BIEN  
import os  
api\_key \= os.getenv('ANTHROPIC\_API\_KEY')  
if not api\_key:  
    raise ValueError('ANTHROPIC\_API\_KEY not set')  
client \= Anthropic(api\_key=api\_key)  
\`\`\`

\#\#\# Error 2: No manejar rate limits  
\`\`\`python  
\# ❌ MAL  
response \= client.messages.create(...)  \# Falla si rate limit

\# ✅ BIEN  
from anthropic import RateLimitError  
import time

for attempt in range(3):  
    try:  
        response \= client.messages.create(...)  
        break  
    except RateLimitError:  
        if attempt \< 2:  
            time.sleep(2 \*\* attempt)  
        else:  
            raise  
\`\`\`

\#\#\# Error 3: No loggear tokens  
\`\`\`python  
\# ❌ MAL  
response \= client.messages.create(...)  
return response.content\[0\].text

\# ✅ BIEN  
response \= client.messages.create(...)  
logger.info(  
    'Claude API usage',  
    extra={  
        'input\_tokens': response.usage.input\_tokens,  
        'output\_tokens': response.usage.output\_tokens,  
        'cost\_usd': calculate\_cost(response.usage)  
    }  
)  
return response.content\[0\].text  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] API key desde variable de entorno  
\- \[ \] Retry logic para rate limits  
\- \[ \] Timeout configurado (30s)  
\- \[ \] Logging de tokens usados  
\- \[ \] Error handling completo  
\- \[ \] Prompts optimizados (\<1000 tokens input)  
\- \[ \] Prompt caching configurado (si aplica)  
\- \[ \] Testing con mock (no gastar $)

\---

\#\# 📊 Métricas

\*\*Costos estimados (Sonnet 4):\*\*  
\- Input: $3 / 1M tokens  
\- Output: $15 / 1M tokens

\*\*Ejemplo: Prediction típica\*\*  
\- Input: \~500 tokens (contexto customer)  
\- Output: \~100 tokens (mensaje)  
\- Costo: \~$0.0015 por prediction  
\- 1000 predictions/mes \= \~$1.50

\---

\#\# 💡 Para Pato

\#\#\# Setup inicial  
\`\`\`bash  
\# Instalar SDK  
pip install anthropic \--break-system-packages

\# Configurar API key  
export ANTHROPIC\_API\_KEY=sk-ant-api03-...

\# Verificar  
python \-c "import anthropic; print(anthropic.\_\_version\_\_)"  
\`\`\`

\#\#\# Test rápido  
\`\`\`python  
\# test\_claude.py  
from anthropic import Anthropic  
import os

client \= Anthropic(api\_key=os.getenv('ANTHROPIC\_API\_KEY'))

response \= client.messages.create(  
    model='claude-sonnet-4-20250514',  
    max\_tokens=100,  
    messages=\[{  
        'role': 'user',  
        'content': 'Decí "hola mundo" en una frase corta.'  
    }\]  
)

print(response.content\[0\].text)  
print(f"Tokens: {response.usage.input\_tokens \+ response.usage.output\_tokens}")  
\`\`\`

\---  
