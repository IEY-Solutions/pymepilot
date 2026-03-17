\# Skill: psycopg3 Multi-Tenant

\#\# 🎯 Qué es  
Configuración y uso de psycopg3 (PostgreSQL driver para Python) con arquitectura multi-tenant. Incluye connection pooling, seteo de tenant context para RLS, y queries seguras.

\*\*Analogía Simple:\*\*  
psycopg3 es como el "cartero" entre Python y PostgreSQL:  
\- Connection pool \= equipo de carteros (no uno solo)  
\- Tenant context \= dirección específica del edificio  
\- Query \= carta que se entrega  
\- RLS \= seguridad del edificio (solo entrega a quien corresponde)

En PymePilot:  
\- Cada vertical conecta a PostgreSQL  
\- SIEMPRE setea tenant\_id antes de queries  
\- Connection pool reutiliza conexiones (performance)  
\- RLS filtra automáticamente

\*\*Por qué es CRÍTICO:\*\*  
\- Sin tenant context \= data leakage entre tenants  
\- Sin connection pool \= conexiones lentas  
\- Sin error handling \= crashes inesperados

\#\# 📋 Cuándo usar este skill

\#\#\# Usar SIEMPRE:  
\- ✅ Al conectar a PostgreSQL desde Python  
\- ✅ Al implementar queries nuevas  
\- ✅ Al modificar lógica de DB

\#\# 🛠️ Mejores Prácticas

\#\#\# Práctica 1: Setup de Connection Pool  
\`\`\`python  
\# engine/db/connection.py  
import os  
from contextlib import contextmanager  
from uuid import UUID  
import psycopg  
from psycopg\_pool import ConnectionPool  
import logging

logger \= logging.getLogger(\_\_name\_\_)

\# Global connection pool  
\_pool \= None

def get\_pool() \-\> ConnectionPool:  
    """Obtener pool de conexiones (singleton)."""  
    global \_pool  
      
    if \_pool is None:  
        db\_url \= os.getenv('DATABASE\_URL')  
          
        if not db\_url:  
            raise ValueError('DATABASE\_URL not set in environment')  
          
        \_pool \= ConnectionPool(  
            conninfo=db\_url,  
            min\_size=2,        \# Mínimo de conexiones activas  
            max\_size=10,       \# Máximo de conexiones  
            timeout=30.0,      \# Timeout para obtener conexión  
            max\_idle=300.0,    \# Tiempo max que conexión puede estar idle  
            num\_workers=3      \# Workers para mantener pool  
        )  
          
        logger.info('Database connection pool created')  
      
    return \_pool

@contextmanager  
def get\_db\_connection(tenant\_id: UUID):  
    """  
    Context manager para obtener conexión con tenant context.  
      
    Uso:  
        with get\_db\_connection(tenant\_id) as conn:  
            cursor \= conn.execute("SELECT \* FROM customers")  
            ...  
      
    Args:  
        tenant\_id: UUID del tenant  
      
    Yields:  
        psycopg.Connection con tenant context seteado  
    """  
    pool \= get\_pool()  
      
    try:  
        \# Obtener conexión del pool  
        with pool.connection() as conn:  
            \# Setear tenant context (para RLS)  
            conn.execute(  
                "SELECT set\_tenant\_context(%s)",  
                (str(tenant\_id),)  
            )  
              
            logger.debug(  
                f"DB connection acquired with tenant context",  
                extra={'tenant\_id': str(tenant\_id)}  
            )  
              
            yield conn  
              
    except psycopg.OperationalError as e:  
        logger.error(f"Database connection error: {e}", exc\_info=True)  
        raise  
    except Exception as e:  
        logger.error(f"Unexpected database error: {e}", exc\_info=True)  
        raise

def close\_pool():  
    """Cerrar pool de conexiones (cleanup)."""  
    global \_pool  
    if \_pool is not None:  
        \_pool.close()  
        \_pool \= None  
        logger.info('Database connection pool closed')  
\`\`\`

\#\#\# Práctica 2: Queries Seguras  
\`\`\`python  
\# engine/db/queries.py  
from typing import List, Dict, Optional  
from uuid import UUID  
import psycopg  
from psycopg.rows import dict\_row  
import logging

from engine.db.connection import get\_db\_connection

logger \= logging.getLogger(\_\_name\_\_)

def get\_inactive\_customers(  
    tenant\_id: UUID,  
    days\_inactive: int,  
    limit: int \= 50  
) \-\> List\[Dict\]:  
    """  
    Obtener customers inactivos.  
      
    Args:  
        tenant\_id: UUID del tenant  
        days\_inactive: Días sin compra  
        limit: Máximo de resultados  
      
    Returns:  
        Lista de dicts con customer data  
    """  
    with get\_db\_connection(tenant\_id) as conn:  
        \# Usar dict\_row para obtener dicts en vez de tuples  
        cursor \= conn.cursor(row\_factory=dict\_row)  
          
        query \= """  
            SELECT   
                id,  
                name,  
                email,  
                phone,  
                last\_purchase\_date,  
                total\_purchases\_amount,  
                order\_count  
            FROM customers  
            WHERE   
                status \= 'active'  
                AND last\_purchase\_date \< NOW() \- INTERVAL '%s days'  
                AND order\_count \>= 3  
            ORDER BY total\_purchases\_amount DESC  
            LIMIT %s  
        """  
          
        cursor.execute(query, (days\_inactive, limit))  
        results \= cursor.fetchall()  
          
        logger.info(  
            f"Found {len(results)} inactive customers",  
            extra={  
                'tenant\_id': str(tenant\_id),  
                'days\_inactive': days\_inactive,  
                'count': len(results)  
            }  
        )  
          
        return results

def get\_customer\_top\_products(  
    customer\_id: UUID,  
    tenant\_id: UUID,  
    limit: int \= 5  
) \-\> List\[Dict\]:  
    """  
    Obtener productos más comprados por customer.  
      
    Args:  
        customer\_id: UUID del customer  
        tenant\_id: UUID del tenant  
        limit: Máximo de productos  
      
    Returns:  
        Lista de dicts con product data  
    """  
    with get\_db\_connection(tenant\_id) as conn:  
        cursor \= conn.cursor(row\_factory=dict\_row)  
          
        query \= """  
            SELECT   
                p.id,  
                p.name,  
                p.sku,  
                SUM(oi.quantity) as total\_quantity,  
                COUNT(DISTINCT o.id) as order\_count  
            FROM products p  
            JOIN order\_items oi ON p.id \= oi.product\_id  
            JOIN orders o ON oi.order\_id \= o.id  
            WHERE   
                o.customer\_id \= %s  
            GROUP BY p.id, p.name, p.sku  
            ORDER BY total\_quantity DESC  
            LIMIT %s  
        """  
          
        cursor.execute(query, (str(customer\_id), limit))  
        results \= cursor.fetchall()  
          
        return results

def save\_prediction(  
    tenant\_id: UUID,  
    customer\_id: UUID,  
    vertical: str,  
    message\_text: str,  
    confidence\_score: float,  
    claude\_model: str,  
    prompt\_tokens: int,  
    completion\_tokens: int,  
    metadata: Optional\[Dict\] \= None  
) \-\> Dict:  
    """  
    Guardar prediction en DB.  
      
    Args:  
        tenant\_id: UUID del tenant  
        customer\_id: UUID del customer  
        vertical: Nombre de la vertical  
        message\_text: Mensaje generado  
        confidence\_score: Score 0.0-1.0  
        claude\_model: Modelo usado  
        prompt\_tokens: Tokens de input  
        completion\_tokens: Tokens de output  
        metadata: Dict opcional con metadata adicional  
      
    Returns:  
        Dict con prediction guardada  
    """  
    with get\_db\_connection(tenant\_id) as conn:  
        cursor \= conn.cursor(row\_factory=dict\_row)  
          
        query \= """  
            INSERT INTO predictions (  
                tenant\_id,  
                customer\_id,  
                vertical,  
                message\_text,  
                confidence\_score,  
                status,  
                claude\_model,  
                prompt\_tokens,  
                completion\_tokens,  
                metadata  
            ) VALUES (  
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s  
            )  
            RETURNING \*  
        """  
          
        cursor.execute(query, (  
            str(tenant\_id),  
            str(customer\_id),  
            vertical,  
            message\_text,  
            confidence\_score,  
            'pending',  
            claude\_model,  
            prompt\_tokens,  
            completion\_tokens,  
            psycopg.types.json.Json(metadata) if metadata else None  
        ))  
          
        result \= cursor.fetchone()  
          
        \# Commit transaction  
        conn.commit()  
          
        logger.info(  
            f"Prediction saved",  
            extra={  
                'prediction\_id': str(result\['id'\]),  
                'customer\_id': str(customer\_id),  
                'vertical': vertical  
            }  
        )  
          
        return result  
\`\`\`

\#\#\# Práctica 3: Transacciones  
\`\`\`python  
def bulk\_save\_predictions(  
    tenant\_id: UUID,  
    predictions: List\[Dict\]  
) \-\> int:  
    """  
    Guardar múltiples predictions en una transacción.  
      
    Args:  
        tenant\_id: UUID del tenant  
        predictions: Lista de dicts con data de predictions  
      
    Returns:  
        Cantidad de predictions guardadas  
    """  
    with get\_db\_connection(tenant\_id) as conn:  
        cursor \= conn.cursor()  
          
        try:  
            \# BEGIN transaction (implícito)  
              
            saved\_count \= 0  
              
            for pred in predictions:  
                cursor.execute("""  
                    INSERT INTO predictions (  
                        tenant\_id, customer\_id, vertical,  
                        message\_text, confidence\_score, status  
                    ) VALUES (%s, %s, %s, %s, %s, %s)  
                """, (  
                    str(tenant\_id),  
                    str(pred\['customer\_id'\]),  
                    pred\['vertical'\],  
                    pred\['message\_text'\],  
                    pred\['confidence\_score'\],  
                    'pending'  
                ))  
                  
                saved\_count \+= 1  
              
            \# COMMIT transaction  
            conn.commit()  
              
            logger.info(  
                f"Bulk saved {saved\_count} predictions",  
                extra={'count': saved\_count, 'tenant\_id': str(tenant\_id)}  
            )  
              
            return saved\_count  
              
        except Exception as e:  
            \# ROLLBACK automático al salir del context manager  
            logger.error(  
                f"Failed to bulk save predictions",  
                exc\_info=True,  
                extra={'tenant\_id': str(tenant\_id)}  
            )  
            raise  
\`\`\`

\---

\#\# 🚨 Errores Comunes

\#\#\# Error 1: No setear tenant context  
\`\`\`python  
\# ❌ MAL \- Sin tenant context  
pool \= get\_pool()  
with pool.connection() as conn:  
    cursor \= conn.execute("SELECT \* FROM customers")  
    \# RLS no filtra → ve todos los tenants

\# ✅ BIEN \- Con tenant context  
with get\_db\_connection(tenant\_id) as conn:  
    cursor \= conn.execute("SELECT \* FROM customers")  
    \# RLS filtra automáticamente  
\`\`\`

\#\#\# Error 2: SQL injection  
\`\`\`python  
\# ❌ MAL \- Vulnerable a SQL injection  
query \= f"SELECT \* FROM customers WHERE name \= '{name}'"  
cursor.execute(query)

\# ✅ BIEN \- Parametrized query  
query \= "SELECT \* FROM customers WHERE name \= %s"  
cursor.execute(query, (name,))  
\`\`\`

\#\#\# Error 3: No usar connection pool  
\`\`\`python  
\# ❌ MAL \- Nueva conexión cada vez (lento)  
def get\_customers():  
    conn \= psycopg.connect(DATABASE\_URL)  
    cursor \= conn.execute("SELECT \* FROM customers")  
    conn.close()

\# ✅ BIEN \- Reutilizar del pool  
def get\_customers(tenant\_id):  
    with get\_db\_connection(tenant\_id) as conn:  
        cursor \= conn.execute("SELECT \* FROM customers")  
\`\`\`

\---

\#\# ✅ Checklist

\- \[ \] Connection pool configurado  
\- \[ \] Tenant context seteado SIEMPRE  
\- \[ \] Queries parametrizadas (no string concat)  
\- \[ \] Error handling completo  
\- \[ \] Logging de queries lentas  
\- \[ \] Transacciones para múltiples writes  
\- \[ \] dict\_row para resultados legibles

\---  
