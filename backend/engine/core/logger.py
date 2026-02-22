"""
Logger seguro con sanitizacion automatica de datos sensibles.

QUE HACE ESTE ARCHIVO:
Es el sistema de logging centralizado del proyecto. Todos los modulos
importan su logger desde aca con: from backend.engine.core.logger import get_logger

CONCEPTO CLAVE - SanitizingFormatter:
Es un "filtro de agua" obligatorio para TODOS los mensajes de log.
Antes de que cualquier mensaje se escriba a archivo o consola,
este formatter lo escanea y reemplaza datos sensibles (tokens,
passwords, API keys) por ***REDACTED***.

No es opcional. No se puede bypassear. Si usas el logger del proyecto,
la sanitizacion ocurre automaticamente.

SEGUNDA LINEA DE DEFENSA - audit_logs_for_secrets():
Despues de cada sync, se escanea el archivo de log buscando patrones
que NO deberian estar ahi. Si el SanitizingFormatter funciono bien,
siempre retorna 0.
"""

import logging
import os
import re
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path


class SanitizingFormatter(logging.Formatter):
    """Formatter que intercepta TODOS los mensajes de log y sanitiza
    automaticamente cualquier dato sensible ANTES de escribirlo.

    No es opcional. No se puede bypassear. Si usas el logger del proyecto,
    la sanitizacion ocurre automaticamente."""

    SENSITIVE_PATTERNS = [
        # Palabras clave en campos de datos
        "token", "secret", "password", "key", "authorization",
        "bearer", "credential", "auth", "access_token",
        "client_secret", "api_key",
        # Nombres exactos de variables de entorno sensibles
        "ERP_ENCRYPTION_KEY", "erp_encryption_key",
        "DATABASE_PASSWORD", "database_password",
        "ANTHROPIC_API_KEY", "anthropic_api_key",
    ]

    # Regex pre-compilada para detectar patron "keyword=valor" o "keyword: valor"
    # Case-insensitive para las palabras clave
    _KEYWORD_PATTERN = re.compile(
        r'(?i)(' + '|'.join(re.escape(p) for p in SENSITIVE_PATTERNS) +
        r')(\s*[:=]\s*)(\S+)',
    )

    SENSITIVE_REGEXES = [
        # Patron Bearer token en texto libre
        re.compile(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*'),
        # Patron Fernet token
        re.compile(r'gAAAAAB[A-Za-z0-9\-_=]+'),
        # Patron tokens en query params de URLs
        re.compile(r'[?&](token|access_token|api_key|client_secret)=[^&\s]+'),
    ]

    REDACTED = '***REDACTED***'

    def _sanitize(self, msg: str) -> str:
        """Aplica sanitizacion de regexes y palabras clave sobre un string.

        ORDEN: regexes PRIMERO, keywords DESPUES.
        Por que: si keyword corre primero sobre 'Token: Bearer eyJhb...',
        reemplaza 'Bearer' como valor de 'Token:' y deja el JWT visible.
        Con regexes primero, 'Bearer eyJhb...' se reemplaza completo."""
        # Paso A: reemplazar patrones de valores reales (Bearer, Fernet, query params)
        for regex in self.SENSITIVE_REGEXES:
            msg = regex.sub(self.REDACTED, msg)
        # Paso B: reemplazar valores asociados a palabras clave sensibles
        msg = self._KEYWORD_PATTERN.sub(
            lambda m: m.group(1) + m.group(2) + self.REDACTED, msg
        )
        return msg

    def format(self, record: logging.LogRecord) -> str:
        """Sobreescribe format() para sanitizar el mensaje principal.

        ORDEN DE OPERACIONES (estricto, no reordenable):
        Paso 1: msg = record.getMessage()  — interpola los args del log.
        Paso 2: Aplicar SENSITIVE_PATTERNS sobre msg.
        Paso 3: Aplicar SENSITIVE_REGEXES sobre msg.
        Paso 4: Asignar msg sanitizado de vuelta a record.msg, limpiar args.
        Paso 4b: Sanitizar record.exc_text si existe.
        Paso 5: Llamar super().format(record) para timestamp, level, etc.
        """
        # Paso 1: interpolar args ANTES de sanitizar
        msg = record.getMessage()

        # Pasos 2-3: sanitizar el mensaje interpolado
        msg = self._sanitize(msg)

        # Paso 4: asignar de vuelta y limpiar args para evitar re-interpolacion
        record.msg = msg
        record.args = None

        # Paso 4b: sanitizar exc_text si existe (path de filtracion no obvio)
        if record.exc_text:
            record.exc_text = self._sanitize(record.exc_text)

        # Paso 5: formateo final (timestamp, level, etc.)
        return super().format(record)

    def formatException(self, ei) -> str:
        """Sobreescritura obligatoria.

        El traceback puede incluir repr() de variables locales. Si
        _access_token o client_secret son variables locales en el frame
        que lanzo la excepcion, sus valores aparecen en el traceback.
        Sanitizamos el traceback completo despues de formatearlo."""
        result = super().formatException(ei)
        return self._sanitize(result)

    def formatStack(self, stack_info: str) -> str:
        """Sobreescritura obligatoria. Misma logica que formatException().
        stack_info es el otro punto donde Python incluye contexto de
        variables en el log."""
        result = super().formatStack(stack_info)
        return self._sanitize(result)


# --- Configuracion del logger ---

# Directorio de logs con permisos restrictivos
_LOG_DIR = Path(__file__).resolve().parent.parent.parent / 'logs'
_LOG_FILE = _LOG_DIR / 'pymepilot.log'

# Formato comun para todos los handlers
_LOG_FORMAT = '%(asctime)s %(levelname)s [%(name)s] %(message)s'
_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'


def _ensure_log_dir() -> None:
    """Crea el directorio de logs con permisos 700 si no existe."""
    _LOG_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(_LOG_DIR, 0o700)


def get_logger(name: str) -> logging.Logger:
    """Retorna un logger configurado con SanitizingFormatter.
    Es el UNICO punto de entrada para logging en todo el proyecto.

    Uso:
        from backend.engine.core.logger import get_logger
        logger = get_logger(__name__)
        logger.info("Sync completado")
    """
    logger = logging.getLogger(name)

    # Evitar agregar handlers duplicados si se llama multiples veces
    if logger.handlers:
        return logger

    formatter = SanitizingFormatter(fmt=_LOG_FORMAT, datefmt=_DATE_FORMAT)

    # Handler de consola (siempre activo)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # Handler de archivo con rotacion diaria (solo si el directorio es accesible)
    try:
        _ensure_log_dir()
        file_handler = TimedRotatingFileHandler(
            filename=str(_LOG_FILE),
            when='midnight',
            interval=1,
            backupCount=7,  # maximo 7 archivos, despues se borran
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        # Permisos 600 en el archivo de log (solo owner puede leer/escribir)
        if _LOG_FILE.exists():
            os.chmod(_LOG_FILE, 0o600)

    except OSError:
        # Si no se puede crear el directorio/archivo (ej: permisos),
        # al menos el logger de consola sigue funcionando
        logger.warning("No se pudo configurar file handler para logs")

    # Nivel por defecto (se sobreescribe desde settings en los entry points)
    logger.setLevel(logging.DEBUG)

    return logger


def audit_logs_for_secrets(log_file: str) -> int:
    """Segunda linea de defensa. Escanea un archivo de log buscando patrones
    sensibles que NO deberian estar ahi (si SanitizingFormatter funciono bien,
    esta funcion siempre retorna 0).

    Parametros:
        log_file: ruta absoluta al archivo de log a escanear.

    Retorna:
        int: cantidad de lineas donde se encontraron patrones sensibles.
        0 = limpio, >0 = hallazgos.

    Comportamiento cuando encuentra un patron (count > 0):
        1. Loguea WARNING por CADA hallazgo (sin incluir contenido de la linea).
        2. Retorna el count total al caller.
        3. NO modifica sync_log (no es su responsabilidad).
        4. NO lanza excepcion (es una verificacion defensiva, no un error).
        5. NO borra ni modifica el archivo de log.
    """
    # Patrones que busca: SOLO valores que parecen tokens/secrets reales.
    # NO busca palabras clave como 'password' porque pueden aparecer
    # legitimamente en logs ('password validation failed').
    audit_regexes = [
        re.compile(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*'),
        re.compile(r'gAAAAAB[A-Za-z0-9\-_=]+'),
        re.compile(r'[?&](token|access_token|api_key|client_secret)=[^&\s]+'),
    ]

    logger = logging.getLogger('pymepilot.audit')
    count = 0

    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, start=1):
                for regex in audit_regexes:
                    if regex.search(line):
                        logger.warning(
                            f"AUDIT: Patron sensible detectado en {log_file} linea {line_num}"
                        )
                        count += 1
                        break  # una vez detectado en esta linea, no seguir con mas regexes
    except FileNotFoundError:
        logger.warning(f"AUDIT: Archivo de log no encontrado: {log_file}")
    except OSError as e:
        logger.warning(f"AUDIT: Error leyendo archivo de log {log_file}: {e}")

    return count
