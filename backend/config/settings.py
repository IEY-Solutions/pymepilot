"""
Configuracion central del proyecto PymePilot.

QUE HACE ESTE ARCHIVO:
Centraliza toda la configuracion del sistema en un solo lugar.
Lee valores de las variables de entorno (.env) y define valores por defecto.

CONCEPTO CLAVE - Variables de entorno:
En vez de escribir passwords y API keys directamente en el codigo
(lo cual seria un riesgo de seguridad enorme), los ponemos en un archivo .env
que NUNCA se sube a Git. Este archivo lee esas variables.

NOTA: load_dotenv() se ejecuta en los ENTRY POINTS (scripts), NO aca.
Los modulos del proyecto leen os.environ al importarse (module-level).
Si load_dotenv() no se ejecuto primero en el script, leen strings vacios.
"""

import os


# --- Entorno ---
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG" if ENVIRONMENT == "development" else "INFO")

# --- Base de datos ---
DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = int(os.getenv("DATABASE_PORT", "5432"))
DATABASE_NAME = os.getenv("DATABASE_NAME", "postgres")
DATABASE_USER = os.getenv("DATABASE_USER", "postgres")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

# --- Claude API ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514")
CLAUDE_MAX_TOKENS = int(os.getenv("CLAUDE_MAX_TOKENS", "1500"))

# --- Claude API Cost Control ---
# Limite diario de tokens totales (input + output). Si se supera,
# el sistema BLOQUEA llamadas hasta el dia siguiente.
# 100k tokens/dia ≈ $0.45-1.50 USD/dia segun mix input/output.
DAILY_TOKEN_LIMIT = int(os.getenv("DAILY_TOKEN_LIMIT", "100000"))

# Techo absoluto por llamada individual. NUNCA se puede superar.
# Si alguien pasa max_tokens > este valor, se recorta silenciosamente.
MAX_TOKENS_PER_CALL = int(os.getenv("MAX_TOKENS_PER_CALL", "4000"))

# --- Contabilium API ---
# Solo la URL base. Las credenciales de cada tenant van encriptadas en la DB
# (tabla tenants.erp_config). Ver backend/engine/connectors/crypto.py
CONTABILIUM_API_URL = os.getenv("CONTABILIUM_API_URL", "https://rest.contabilium.com/api")

# --- Encriptacion ERP ---
# NUNCA loguear esta variable. SanitizingFormatter la captura por nombre exacto,
# pero la regla debe estar documentada en el codigo fuente tambien.
ERP_ENCRYPTION_KEY = os.getenv("ERP_ENCRYPTION_KEY", "")

# --- Sync ERP ---
SYNC_PAGE_SIZE = 50           # Registros por pagina en paginacion de API
SYNC_MAX_RETRIES = 3          # Maximo reintentos en errores temporales
SYNC_RATE_LIMIT_DELAY = 0.5   # Segundos de espera entre requests (rate limiting respetuoso)

# --- Supabase Storage (para Smart File Upload) ---
# URL interna del API gateway de Supabase (Kong).
# El worker descarga archivos de Storage usando esta URL + SERVICE_ROLE_KEY.
# NUNCA loguear SERVICE_ROLE_KEY — SanitizingFormatter la captura por patron.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
