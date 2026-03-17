\# Skill: Vertical Template

\#\# 🎯 Qué es  
Template reutilizable para implementar verticales de IA en PymePilot. Cada vertical sigue la misma estructura: obtener data, construir prompt, llamar Claude, guardar prediction. Este template garantiza consistencia y facilita agregar verticales nuevas.

\*\*Analogía Simple:\*\*  
El template es como una receta de cocina master:  
\- Ingredientes (data del customer)  
\- Preparación (construcción de prompt)  
\- Cocción (llamada a Claude)  
\- Emplatado (guardado en DB)  
\- Cada vertical es una receta diferente con misma estructura

En PymePilot:  
\- Vertical Activación \= misma estructura que Reposición  
\- Cambia: lógica de filtrado \+ prompt  
\- NO cambia: patrón de ejecución

\*\*Por qué es CRÍTICO:\*\*  
\- Consistencia entre verticales  
\- Fácil agregar verticales nuevas  
\- Testing simplificado  
\- Mantenimiento más sencillo

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al implementar vertical nueva  
\- ✅ Al refactorizar vertical existente  
\- ✅ Al documentar verticales

\#\#\# Usar ESPECIALMENTE cuando:  
\- ⚠️ Comportamiento inconsistente entre verticales  
\- ⚠️ Código duplicado entre verticales  
\- ⚠️ Dificultad para testear verticales

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Base Class  
\`\`\`python  
\# engine/verticales/base.py  
from abc import ABC, abstractmethod  
from typing import List, Dict, Optional  
from uuid import UUID  
import logging

from engine.claude.client import get\_claude\_client  
from engine.db.queries import save\_prediction

logger \= logging.getLogger(\_\_name\_\_)

class VerticalBase(ABC):  
    """  
    Clase base para todas las verticales.  
      
    Cada vertical debe implementar:  
    \- get\_candidates(): Obtener customers candidatos  
    \- build\_prompt(): Construir prompt para Claude  
    \- calculate\_confidence(): Calcular score de confianza  
    """  
      
    def \_\_init\_\_(self):  
        self.claude \= get\_claude\_client()  
        self.vertical\_name \= self.\_\_class\_\_.\_\_name\_\_.lower().replace('vertical', '')  
      
    @abstractmethod  
    def get\_candidates(  
        self,  
        tenant\_id: UUID,  
        limit: int \= 50  
    ) \-\> List\[Dict\]:  
        """  
        Obtener lista de customers candidatos para esta vertical.  
          
        Args:  
            tenant\_id: UUID del tenant  
            limit: Máximo de candidates a retornar  
          
        Returns:  
            Lista de dicts con customer data  
        """  
        pass  
      
    @abstractmethod  
    def build\_prompt(self, customer: Dict, context: Optional\[Dict\] \= None) \-\> str:  
        """  
        Construir prompt para Claude.  
          
        Args:  
            customer: Dict con data del customer  
            context: Dict opcional con contexto adicional  
          
        Returns:  
            Prompt completo como string  
        """  
        pass  
      
    @abstractmethod  
    def calculate\_confidence(  
        self,  
        customer: Dict,  
        message: str,  
        context: Optional\[Dict\] \= None  
    ) \-\> float:  
        """  
        Calcular score de confianza (0.0-1.0).  
          
        Args:  
            customer: Dict con data del customer  
            message: Mensaje generado por Claude  
            context: Dict opcional con contexto  
          
        Returns:  
            Float entre 0.0 y 1.0  
        """  
        pass  
      
    def run(  
        self,  
        tenant\_id: UUID,  
        limit: int \= 50,  
        temperature: float \= 0.7,  
        max\_tokens: int \= 200  
    ) \-\> List\[Dict\]:  
        """  
        Ejecutar vertical completa.  
          
        Este método NO debe ser overrideado.  
          
        Args:  
            tenant\_id: UUID del tenant  
            limit: Máximo de predictions a generar  
            temperature: Temperature para Claude (0.0-1.0)  
            max\_tokens: Max tokens en completion  
          
        Returns:  
            Lista de predictions generadas  
        """  
        logger.info(  
            f"Running {self.vertical\_name} vertical",  
            extra={  
                'tenant\_id': str(tenant\_id),  
                'limit': limit,  
                'vertical': self.vertical\_name  
            }  
        )  
          
        \# 1\. Obtener candidates  
        try:  
            candidates \= self.get\_candidates(tenant\_id, limit)  
        except Exception as e:  
            logger.error(  
                f"Failed to get candidates for {self.vertical\_name}",  
                exc\_info=True,  
                extra={'tenant\_id': str(tenant\_id)}  
            )  
            raise  
          
        logger.info(  
            f"Found {len(candidates)} candidates",  
            extra={'count': len(candidates), 'vertical': self.vertical\_name}  
        )  
          
        if not candidates:  
            logger.warning("No candidates found")  
            return \[\]  
          
        predictions \= \[\]  
          
        \# 2\. Procesar cada candidate  
        for i, customer in enumerate(candidates, 1):  
            try:  
                logger.debug(  
                    f"Processing candidate {i}/{len(candidates)}",  
                    extra={  
                        'customer\_id': str(customer\['id'\]),  
                        'progress': f"{i}/{len(candidates)}"  
                    }  
                )  
                  
                \# 2a. Obtener contexto adicional (opcional)  
                context \= self.get\_context(customer, tenant\_id)  
                  
                \# 2b. Construir prompt  
                prompt \= self.build\_prompt(customer, context)  
                  
                \# 2c. Generar mensaje con Claude  
                response \= self.claude.generate\_message(  
                    prompt=prompt,  
                    max\_tokens=max\_tokens,  
                    temperature=temperature  
                )  
                  
                message\_text \= response\['text'\].strip()  
                  
                \# 2d. Calcular confidence score  
                confidence \= self.calculate\_confidence(  
                    customer,  
                    message\_text,  
                    context  
                )  
                  
                \# 2e. Guardar prediction  
                prediction \= save\_prediction(  
                    tenant\_id=tenant\_id,  
                    customer\_id=customer\['id'\],  
                    vertical=self.vertical\_name,  
                    message\_text=message\_text,  
                    confidence\_score=confidence,  
                    claude\_model=response\['model'\],  
                    prompt\_tokens=response\['usage'\]\['input\_tokens'\],  
                    completion\_tokens=response\['usage'\]\['output\_tokens'\],  
                    metadata={  
                        'context': context,  
                        'temperature': temperature  
                    }  
                )  
                  
                predictions.append(prediction)  
                  
                logger.info(  
                    f"Prediction generated",  
                    extra={  
                        'customer\_id': str(customer\['id'\]),  
                        'confidence': confidence,  
                        'tokens': response\['usage'\]\['total\_tokens'\],  
                        'vertical': self.vertical\_name  
                    }  
                )  
                  
            except Exception as e:  
                logger.error(  
                    f"Failed to process customer {customer.get('id')}",  
                    exc\_info=True,  
                    extra={  
                        'customer\_id': str(customer.get('id')),  
                        'vertical': self.vertical\_name  
                    }  
                )  
                \# Continuar con siguiente  
                continue  
          
        logger.info(  
            f"{self.vertical\_name} vertical completed",  
            extra={  
                'predictions\_generated': len(predictions),  
                'candidates\_processed': len(candidates),  
                'success\_rate': len(predictions) / len(candidates) if candidates else 0  
            }  
        )  
          
        return predictions  
      
    def get\_context(self, customer: Dict, tenant\_id: UUID) \-\> Optional\[Dict\]:  
        """  
        Obtener contexto adicional para el customer.  
          
        Override si necesitás contexto extra (productos, pedidos, etc.)  
          
        Args:  
            customer: Dict con data del customer  
            tenant\_id: UUID del tenant  
          
        Returns:  
            Dict con contexto o None  
        """  
        return None  
\`\`\`

\#\#\# Práctica 2: Implementar Vertical (Activación)  
\`\`\`python  
\# engine/verticales/activacion.py  
from typing import List, Dict, Optional  
from uuid import UUID  
from datetime import datetime, timedelta

from engine.verticales.base import VerticalBase  
from engine.db.queries import (  
    get\_customers\_by\_filter,  
    get\_customer\_top\_products  
)

class VerticalActivacion(VerticalBase):  
    """Vertical para reactivar clientes inactivos."""  
      
    def \_\_init\_\_(self):  
        super().\_\_init\_\_()  
        self.days\_inactive\_threshold \= 90  
        self.min\_previous\_orders \= 3  \# Mínimo de pedidos históricos  
      
    def get\_candidates(self, tenant\_id: UUID, limit: int \= 50\) \-\> List\[Dict\]:  
        """  
        Obtener clientes inactivos candidatos.  
          
        Criterios:  
        \- Sin compra en los últimos 90 días  
        \- Al menos 3 pedidos históricos  
        \- Status \= 'active'  
        """  
        cutoff\_date \= datetime.now() \- timedelta(days=self.days\_inactive\_threshold)  
          
        candidates \= get\_customers\_by\_filter(  
            tenant\_id=tenant\_id,  
            filters={  
                'status': 'active',  
                'last\_purchase\_date\_\_lt': cutoff\_date,  
                'order\_count\_\_gte': self.min\_previous\_orders  
            },  
            order\_by='total\_purchases\_amount',  \# Más gastadores primero  
            order\_dir='DESC',  
            limit=limit  
        )  
          
        return candidates  
      
    def get\_context(self, customer: Dict, tenant\_id: UUID) \-\> Optional\[Dict\]:  
        """Obtener productos más comprados por el customer."""  
        top\_products \= get\_customer\_top\_products(  
            customer\_id=customer\['id'\],  
            tenant\_id=tenant\_id,  
            limit=5  
        )  
          
        return {  
            'top\_products': \[p\['name'\] for p in top\_products\],  
            'days\_inactive': (datetime.now() \- datetime.fromisoformat(  
                customer\['last\_purchase\_date'\]  
            )).days  
        }  
      
    def build\_prompt(self, customer: Dict, context: Optional\[Dict\] \= None) \-\> str:  
        """Construir prompt para mensaje de activación."""  
          
        days\_inactive \= context\['days\_inactive'\] if context else 90  
        top\_products \= context.get('top\_products', \[\]) if context else \[\]  
          
        prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es generar un mensaje de WhatsApp corto para reactivar un cliente inactivo.

INFORMACIÓN DEL CLIENTE:  
\- Nombre: {customer\['name'\]}  
\- Última compra: hace {days\_inactive} días  
\- Total comprado históricamente: ${customer.get('total\_purchases\_amount', 0):,.2f}  
\- Productos que más compró: {', '.join(top\_products\[:3\]) if top\_products else 'No disponible'}

INSTRUCCIONES:  
1\. Mensaje de máximo 3 líneas (50 palabras)  
2\. Tono: amigable, directo, profesional  
3\. Mencioná al cliente por nombre  
4\. Hacé referencia a productos que compraba  
5\. Incluí llamado a la acción (ejemplo: "Te pasamos el catálogo actualizado?")  
6\. NO uses emojis  
7\. NO uses markdown  
8\. NO uses saludos formales excesivos

EJEMPLO:  
"Hola Juan\! Hace tiempo que no te vemos. Tenemos novedades en fundas MagSafe que te encantaban. Te pasamos el catálogo actualizado?"

GENERÁ EL MENSAJE:"""  
          
        return prompt  
      
    def calculate\_confidence(  
        self,  
        customer: Dict,  
        message: str,  
        context: Optional\[Dict\] \= None  
    ) \-\> float:  
        """  
        Calcular confidence score para activación.  
          
        Factores:  
        \- Días inactivo (menos días \= más confianza)  
        \- Total gastado históricamente (más $ \= más confianza)  
        \- Cantidad de productos conocidos (más info \= más confianza)  
        """  
        score \= 0.5  \# Base  
          
        \# Factor 1: Días inactivo (0.0 \- 0.2)  
        days \= context\['days\_inactive'\] if context else 90  
        if days \< 120:  
            score \+= 0.2  
        elif days \< 180:  
            score \+= 0.1  
          
        \# Factor 2: Total gastado (0.0 \- 0.2)  
        total \= customer.get('total\_purchases\_amount', 0\)  
        if total \> 1\_000\_000:  \# \>1M  
            score \+= 0.2  
        elif total \> 500\_000:  \# \>500K  
            score \+= 0.1  
          
        \# Factor 3: Info disponible (0.0 \- 0.1)  
        if context and context.get('top\_products'):  
            score \+= 0.1  
          
        return min(score, 1.0)  
\`\`\`

\#\#\# Práctica 3: Implementar Vertical (Reposición)  
\`\`\`python  
\# engine/verticales/reposicion.py  
from typing import List, Dict, Optional  
from uuid import UUID  
from datetime import datetime, timedelta

from engine.verticales.base import VerticalBase  
from engine.db.queries import (  
    get\_customers\_active,  
    get\_products\_needing\_restock  
)

class VerticalReposicion(VerticalBase):  
    """Vertical para sugerir reposición de stock."""  
      
    def \_\_init\_\_(self):  
        super().\_\_init\_\_()  
        self.prediction\_window\_days \= 14  \# Predecir próximos 14 días  
      
    def get\_candidates(self, tenant\_id: UUID, limit: int \= 50\) \-\> List\[Dict\]:  
        """  
        Obtener clientes activos que podrían necesitar restock.  
          
        Criterios:  
        \- Clientes activos  
        \- Con compra reciente (\<60 días)  
        \- Patrón de compra regular  
        """  
        recent\_date \= datetime.now() \- timedelta(days=60)  
          
        candidates \= get\_customers\_active(  
            tenant\_id=tenant\_id,  
            last\_purchase\_after=recent\_date,  
            has\_regular\_pattern=True,  
            limit=limit  
        )  
          
        return candidates  
      
    def get\_context(self, customer: Dict, tenant\_id: UUID) \-\> Optional\[Dict\]:  
        """Obtener productos que el customer podría necesitar reponer."""  
          
        products\_low\_stock \= get\_products\_needing\_restock(  
            customer\_id=customer\['id'\],  
            tenant\_id=tenant\_id,  
            prediction\_days=self.prediction\_window\_days  
        )  
          
        return {  
            'products\_low\_stock': products\_low\_stock\[:3\],  \# Top 3  
            'prediction\_window': self.prediction\_window\_days  
        }  
      
    def build\_prompt(self, customer: Dict, context: Optional\[Dict\] \= None) \-\> str:  
        """Construir prompt para mensaje de reposición."""  
          
        products \= context.get('products\_low\_stock', \[\]) if context else \[\]  
          
        if not products:  
            \# Sin productos para sugerir  
            return None  
          
        products\_text \= '\\n'.join(\[  
            f"- {p\['name'\]}: última compra hace {p\['days\_since\_last\_purchase'\]} días "  
            f"(promedio cada {p\['avg\_days\_between\_purchases'\]} días)"  
            for p in products  
        \])  
          
        prompt \= f"""Sos un asistente de ventas B2B para distribuidores mayoristas en Argentina.

Tu tarea es sugerir reposición de stock de manera útil y no invasiva.

INFORMACIÓN DEL CLIENTE:  
\- Nombre: {customer\['name'\]}

PRODUCTOS QUE PODRÍA NECESITAR REPONER PRONTO:  
{products\_text}

INSTRUCCIONES:  
1\. Mensaje de máximo 3 líneas (50 palabras)  
2\. Tono: útil, no agresivo  
3\. Mencioná 1-2 productos específicos  
4\. Sugerí que podría necesitar restock pronto  
5\. Llamado a la acción: ofrecer presupuesto rápido  
6\. NO uses emojis ni markdown

EJEMPLO:  
"Hola María\! Vimos que solés pedir fundas iPhone cada 30 días. Ya pasaron 28\. Querés que te armemos un presupuesto para esta semana?"

GENERÁ EL MENSAJE:"""  
          
        return prompt  
      
    def calculate\_confidence(  
        self,  
        customer: Dict,  
        message: str,  
        context: Optional\[Dict\] \= None  
    ) \-\> float:  
        """  
        Calcular confidence para reposición.  
          
        Factores:  
        \- Regularidad del patrón de compra  
        \- Precisión de la predicción  
        \- Cantidad de productos identificados  
        """  
        score \= 0.6  \# Base más alto (reposición es más precisa)  
          
        if not context or not context.get('products\_low\_stock'):  
            return 0.3  \# Baja confianza si no hay productos  
          
        products \= context\['products\_low\_stock'\]  
          
        \# Factor 1: Productos identificados (0.0 \- 0.2)  
        if len(products) \>= 3:  
            score \+= 0.2  
        elif len(products) \>= 2:  
            score \+= 0.1  
          
        \# Factor 2: Precisión del patrón (0.0 \- 0.2)  
        avg\_precision \= sum(  
            p.get('pattern\_variance', 1.0) for p in products  
        ) / len(products)  
          
        if avg\_precision \< 0.2:  \# Patrón muy regular  
            score \+= 0.2  
        elif avg\_precision \< 0.4:  
            score \+= 0.1  
          
        return min(score, 1.0)  
\`\`\`

\---

\#\# 💻 Ejemplo Completo: Ejecutar Vertical  
\`\`\`python  
\# scripts/run\_vertical.py  
"""  
Script para ejecutar una vertical manualmente.

Uso:  
    python run\_vertical.py \--tenant-id UUID \--vertical activacion \--limit 10  
"""  
import argparse  
import logging  
from uuid import UUID

from engine.verticales.activacion import VerticalActivacion  
from engine.verticales.reposicion import VerticalReposicion  
from engine.verticales.cross\_sell import VerticalCrossSell  
from engine.verticales.recuperacion import VerticalRecuperacion

\# Configurar logging  
logging.basicConfig(  
    level=logging.INFO,  
    format='%(asctime)s \- %(name)s \- %(levelname)s \- %(message)s'  
)

VERTICALES \= {  
    'activacion': VerticalActivacion,  
    'reposicion': VerticalReposicion,  
    'cross\_sell': VerticalCrossSell,  
    'recuperacion': VerticalRecuperacion  
}

def main():  
    parser \= argparse.ArgumentParser(description='Run a vertical')  
    parser.add\_argument('--tenant-id', required=True, help='Tenant UUID')  
    parser.add\_argument('--vertical', required=True, choices=VERTICALES.keys())  
    parser.add\_argument('--limit', type=int, default=50, help='Max predictions')  
    parser.add\_argument('--temperature', type=float, default=0.7)  
      
    args \= parser.parse\_args()  
      
    \# Instanciar vertical  
    vertical\_class \= VERTICALES\[args.vertical\]  
    vertical \= vertical\_class()  
      
    \# Ejecutar  
    tenant\_id \= UUID(args.tenant\_id)  
      
    predictions \= vertical.run(  
        tenant\_id=tenant\_id,  
        limit=args.limit,  
        temperature=args.temperature  
    )  
      
    print(f"\\n✅ Generated {len(predictions)} predictions")  
      
    \# Mostrar primeras 3  
    for i, pred in enumerate(predictions\[:3\], 1):  
        print(f"\\n--- Prediction {i} \---")  
        print(f"Customer: {pred\['customer\_id'\]}")  
        print(f"Message: {pred\['message\_text'\]}")  
        print(f"Confidence: {pred\['confidence\_score'\]:.2f}")

if \_\_name\_\_ \== '\_\_main\_\_':  
    main()  
\`\`\`

\*\*Ejecutar:\*\*  
\`\`\`bash  
\# Activación  
python scripts/run\_vertical.py \\  
    \--tenant-id 123e4567-e89b-12d3-a456-426614174000 \\  
    \--vertical activacion \\  
    \--limit 10

\# Reposición  
python scripts/run\_vertical.py \\  
    \--tenant-id 123e4567-e89b-12d3-a456-426614174000 \\  
    \--vertical reposicion \\  
    \--limit 20  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No usar base class  
\`\`\`python  
\# ❌ MAL \- Código duplicado  
class VerticalActivacion:  
    def run(self, tenant\_id):  
        \# ... todo manual  
          
class VerticalReposicion:  
    def run(self, tenant\_id):  
        \# ... mismo código duplicado

\# ✅ BIEN \- Heredar de base  
class VerticalActivacion(VerticalBase):  
    def get\_candidates(self, tenant\_id, limit):  
        \# Solo la lógica específica  
\`\`\`

\#\#\# Error 2: Lógica inconsistente  
\`\`\`python  
\# ❌ MAL \- Cada vertical hace las cosas diferente  
class VerticalA:  
    def execute(self):  \# Nombre diferente  
        \# Orden diferente de steps  
          
class VerticalB:  
    def run\_vertical(self):  \# Otro nombre  
        \# Otro orden de steps

\# ✅ BIEN \- Mismo patrón  
class VerticalA(VerticalBase):  
    \# run() ya está implementado en base  
    def get\_candidates(self): ...  
    def build\_prompt(self): ...  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Hereda de VerticalBase  
\- \[ \] Implementa get\_candidates()  
\- \[ \] Implementa build\_prompt()  
\- \[ \] Implementa calculate\_confidence()  
\- \[ \] NO overridea run() (usa el de base)  
\- \[ \] Logging en puntos clave  
\- \[ \] Error handling robusto  
\- \[ \] Type hints completos

\---  
