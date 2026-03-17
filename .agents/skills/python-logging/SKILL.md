\# Skill: Python Logging

\#\# 🎯 Qué es  
Configuración de logging estructurado en Python para PymePilot. Logs en formato JSON, niveles apropiados, y sin secrets expuestos.

\*\*Analogía Simple:\*\*  
Logging es como el "diario de vuelo" del sistema:  
\- INFO \= evento normal ("despegamos a las 10am")  
\- WARNING \= algo raro pero no crítico ("turbulencia leve")  
\- ERROR \= problema serio ("falla en motor")  
\- DEBUG \= detalles técnicos ("velocidad 850 km/h")

\*\*Por qué es CRÍTICO:\*\*  
\- Debugging en producción  
\- Tracking de performance  
\- Auditoría de operaciones  
\- Alertas automáticas

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Setup Base  
\`\`\`python  
\# engine/utils/logging.py  
import logging  
import logging.config  
import json  
from datetime import datetime

def setup\_logging(level=logging.INFO):  
    """Configurar logging estructurado."""  
      
    config \= {  
        'version': 1,  
        'disable\_existing\_loggers': False,  
        'formatters': {  
            'json': {  
                'class': 'pythonjsonlogger.jsonlogger.JsonFormatter',  
                'format': '%(asctime)s %(name)s %(levelname)s %(message)s'  
            }  
        },  
        'handlers': {  
            'console': {  
                'class': 'logging.StreamHandler',  
                'formatter': 'json',  
                'stream': 'ext://sys.stdout'  
            }  
        },  
        'root': {  
            'level': level,  
            'handlers': \['console'\]  
        }  
    }  
      
    logging.config.dictConfig(config)  
\`\`\`

\*\*Uso:\*\*  
\`\`\`python  
\# main.py  
from engine.utils.logging import setup\_logging  
import logging

setup\_logging(level=logging.INFO)  
logger \= logging.getLogger(\_\_name\_\_)

logger.info("Application started")  
\`\`\`

\#\#\# Práctica 2: Logging Estructurado  
\`\`\`python  
\# En verticales  
logger.info(  
    "Prediction generated",  
    extra={  
        'customer\_id': str(customer\_id),  
        'vertical': 'activacion',  
        'confidence': 0.85,  
        'tokens': 450,  
        'latency\_ms': 2340  
    }  
)

\# Output JSON:  
{  
    "timestamp": "2025-02-17T10:30:45.123Z",  
    "name": "engine.verticales.activacion",  
    "level": "INFO",  
    "message": "Prediction generated",  
    "customer\_id": "abc-123",  
    "vertical": "activacion",  
    "confidence": 0.85,  
    "tokens": 450,  
    "latency\_ms": 2340  
}  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Formato JSON  
\- \[ \] Niveles apropiados (DEBUG/INFO/WARNING/ERROR)  
\- \[ \] NO loggear secrets  
\- \[ \] Contexto en extra={}  
\- \[ \] Timestamp incluido

\---  
