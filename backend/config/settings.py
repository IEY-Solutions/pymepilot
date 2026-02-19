"""
Configuracion central del proyecto PymePilot.

QUE HACE ESTE ARCHIVO:
Centraliza toda la configuracion del sistema en un solo lugar.
Lee valores de las variables de entorno (.env) y define valores por defecto.

CONCEPTO CLAVE - Variables de entorno:
En vez de escribir passwords y API keys directamente en el codigo
(lo cual seria un riesgo de seguridad enorme), los ponemos en un archivo .env
que NUNCA se sube a Git. Este archivo lee esas variables.
"""

import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()


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
CLAUDE_MAX_TOKENS = int(os.getenv("CLAUDE_MAX_TOKENS", "1024"))

# --- Contabilium API ---
CONTABILIUM_API_URL = os.getenv("CONTABILIUM_API_URL", "https://rest.contabilium.com/api")
CONTABILIUM_CLIENT_ID = os.getenv("CONTABILIUM_CLIENT_ID", "")
CONTABILIUM_CLIENT_SECRET = os.getenv("CONTABILIUM_CLIENT_SECRET", "")
