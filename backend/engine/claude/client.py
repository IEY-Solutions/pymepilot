"""
Cliente Claude API con control de costos implacable (4 capas).

QUE HACE ESTE ARCHIVO:
Es el UNICO punto de contacto con la API de Anthropic (Claude).
Ningun otro archivo del proyecto llama a Claude directamente.
Todo pasa por aca, y aca se aplican los controles de costo.

4 CAPAS DE CONTROL (todas obligatorias, no se pueden saltear):
  1. LIMITE DIARIO: Consulta api_usage en DB antes de cada llamada.
     Si se supero el limite → DailyLimitExceeded, no se llama a Claude.
  2. LIMITE POR LLAMADA: max_tokens nunca puede superar MAX_TOKENS_PER_CALL.
     Si alguien pasa un valor mayor → se recorta y se loguea warning.
  3. REGISTRO POST-LLAMADA: En bloque finally (se ejecuta SIEMPRE, aunque
     falle la API) registra tokens usados y costo en api_usage.
  4. ALERTAS POR LOG: Warning al 70%, Critical al 90% del limite diario.

CONCEPTO CLAVE - Exponential Backoff:
  Cuando la API dice "estoy ocupada" (error 429), en vez de reintentar
  inmediatamente (lo cual la satura mas), esperamos 1 segundo, despues
  2, despues 4. Cada espera es el DOBLE de la anterior. Como cuando
  llamas a un telefono ocupado: esperas cada vez mas.

CONCEPTO CLAVE - Fail-open vs Fail-closed:
  Si la DB esta caida y no podemos consultar api_usage:
  - Fail-closed: bloquear la llamada (seguro pero rompe el servicio)
  - Fail-open: permitir la llamada (arriesgado pero el servicio sigue)
  Elegimos fail-open porque: (a) la DB caida es temporal, (b) Anthropic
  tiene sus propios limites, (c) preferimos gastar unos tokens de mas
  a dejar el servicio muerto.
"""

import time
from decimal import Decimal

import anthropic

from backend.config.settings import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
    CLAUDE_MAX_TOKENS,
    DAILY_TOKEN_LIMIT,
    MAX_TOKENS_PER_CALL,
)
from backend.engine.core.logger import get_logger
from backend.engine.db.connection import get_db_connection_no_tenant

logger = get_logger(__name__)


# --- Excepciones custom ---

class DailyLimitExceeded(Exception):
    """Se supero el limite diario de tokens de Claude API.

    Contiene info util para debugging: tokens usados, limite, fecha.
    El caller debe capturar esta excepcion y decidir que hacer
    (loggear, notificar, esperar al dia siguiente).
    """
    pass


class InvalidTokenLimit(Exception):
    """Configuracion de tokens invalida o API key faltante.

    Se lanza en __init__ si falta ANTHROPIC_API_KEY.
    """
    pass


# --- Precios por token (Claude Sonnet) ---
# Input: $3.00 / 1M tokens = $0.000003 por token
# Output: $15.00 / 1M tokens = $0.000015 por token
# Fuente: https://docs.anthropic.com/en/docs/about-claude/pricing
COST_PER_INPUT_TOKEN = Decimal("0.000003")
COST_PER_OUTPUT_TOKEN = Decimal("0.000015")


class ClaudeClient:
    """Wrapper de Claude API con 4 capas de control de costos.

    Uso:
        client = ClaudeClient()
        result = client.generate_message(
            system_prompt="Sos un asistente de ventas...",
            user_prompt="Genera un mensaje para Juan...",
        )
        print(result["text"])       # El mensaje generado
        print(result["cost_usd"])   # Cuanto costo esta llamada

        # Ver resumen del dia
        usage = client.get_usage_today()
        print(f"Usados: {usage['tokens_used']}/{usage['tokens_limit']}")
    """

    # Maximo reintentos en errores temporales (429, 500, 529)
    MAX_RETRIES = 3

    def __init__(self) -> None:
        """Inicializa el cliente. Falla inmediatamente si no hay API key."""
        if not ANTHROPIC_API_KEY:
            raise InvalidTokenLimit(
                "ANTHROPIC_API_KEY no configurada en .env. "
                "Obtenerla de console.anthropic.com → Settings → API Keys."
            )

        # max_retries=0: desactivamos retry del SDK para manejarlo nosotros
        # con logging explicito de cada reintento.
        self._client = anthropic.Anthropic(
            api_key=ANTHROPIC_API_KEY,
            max_retries=0,
        )
        self._model = CLAUDE_MODEL
        self._daily_limit = DAILY_TOKEN_LIMIT
        self._max_per_call = MAX_TOKENS_PER_CALL

        logger.info(
            f"ClaudeClient inicializado: model={self._model}, "
            f"daily_limit={self._daily_limit}, max_per_call={self._max_per_call}"
        )

    def generate_message(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int | None = None,
    ) -> dict:
        """Genera un mensaje usando Claude API con todas las capas de control.

        Args:
            system_prompt: Instrucciones de sistema para Claude.
            user_prompt: Datos del cliente + contexto para generar el mensaje.
            max_tokens: Max tokens de respuesta. Default: CLAUDE_MAX_TOKENS (1500).
                Si supera MAX_TOKENS_PER_CALL (4000), se recorta con warning.

        Returns:
            dict con keys: text, tokens_input, tokens_output, tokens_total, cost_usd

        Raises:
            DailyLimitExceeded: Si se supero el limite diario de tokens.
            anthropic.AuthenticationError: Si la API key es invalida.
            anthropic.APIStatusError: Si la API falla despues de reintentos.
        """
        # === CAPA 2: Limite por llamada individual ===
        if max_tokens is None:
            max_tokens = CLAUDE_MAX_TOKENS

        if max_tokens > self._max_per_call:
            logger.warning(
                f"max_tokens={max_tokens} excede limite por llamada "
                f"({self._max_per_call}). Sobrescribiendo a {self._max_per_call}."
            )
            max_tokens = self._max_per_call

        # === CAPA 1: Limite diario en DB ===
        usage_today = self._get_usage_from_db()
        tokens_remaining = self._daily_limit - usage_today

        if tokens_remaining <= 0:
            raise DailyLimitExceeded(
                f"Limite diario de tokens alcanzado. "
                f"Usado: {usage_today:,}/{self._daily_limit:,}. "
                f"Reintente manana o aumente DAILY_TOKEN_LIMIT en .env"
            )

        # === CAPA 4 (pre-call): Alertas por log ===
        usage_pct = (usage_today / self._daily_limit) * 100
        if usage_pct > 90:
            logger.critical(
                f"ALERTA COSTOS: {usage_pct:.1f}% del limite diario consumido. "
                f"Tokens restantes: {tokens_remaining:,}"
            )
        elif usage_pct > 70:
            logger.warning(
                f"ALERTA COSTOS: {usage_pct:.1f}% del limite diario consumido. "
                f"Tokens restantes: {tokens_remaining:,}"
            )

        # === Llamada a Claude API con retry ===
        tokens_input = 0
        tokens_output = 0
        response_text = ""

        try:
            response = self._call_with_retry(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=max_tokens,
            )

            tokens_input = response.usage.input_tokens
            tokens_output = response.usage.output_tokens
            response_text = response.content[0].text

        except Exception:
            # Los tokens quedan en 0 si la llamada fallo.
            # Anthropic no cobra por llamadas fallidas.
            raise

        finally:
            # === CAPA 3: Registro post-llamada (SIEMPRE, aunque falle) ===
            tokens_total = tokens_input + tokens_output
            cost_usd = (
                Decimal(tokens_input) * COST_PER_INPUT_TOKEN
                + Decimal(tokens_output) * COST_PER_OUTPUT_TOKEN
            )

            self._record_usage(tokens_input, tokens_output, tokens_total, cost_usd)

            # === CAPA 4 (post-call): Log de tokens consumidos SIEMPRE ===
            logger.info(
                f"Claude API call: {tokens_input} in + {tokens_output} out = "
                f"{tokens_total} tokens (${cost_usd:.6f} USD)"
            )

        return {
            "text": response_text,
            "tokens_input": tokens_input,
            "tokens_output": tokens_output,
            "tokens_total": tokens_input + tokens_output,
            "cost_usd": float(cost_usd),
        }

    def get_usage_today(self) -> dict:
        """Retorna resumen de uso del dia actual.

        Returns:
            dict: tokens_used, tokens_limit, percentage, cost_usd
        """
        tokens_used = self._get_usage_from_db()

        cost_today = Decimal("0")
        try:
            with get_db_connection_no_tenant() as conn:
                result = conn.execute(
                    "SELECT COALESCE(SUM(cost_usd), 0) FROM api_usage "
                    "WHERE usage_date = CURRENT_DATE",
                ).fetchone()
                cost_today = Decimal(str(result[0]))
        except Exception as exc:
            logger.error(f"No se pudo consultar costo diario: {exc}")

        return {
            "tokens_used": tokens_used,
            "tokens_limit": self._daily_limit,
            "percentage": round(
                (tokens_used / self._daily_limit) * 100, 1
            ) if self._daily_limit > 0 else 0,
            "cost_usd": float(cost_today),
        }

    # --- Metodos internos ---

    def _call_with_retry(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int,
    ) -> anthropic.types.Message:
        """Llama a Claude con exponential backoff en errores temporales.

        Errores que reintentan: 429 (rate limit), 500/529 (server error).
        Errores que NO reintentan: 400 (bad request), 401 (auth), otros.
        Max 3 intentos. Backoff: 1s, 2s, 4s.
        """
        for attempt in range(1, self.MAX_RETRIES + 1):
            try:
                return self._client.messages.create(
                    model=self._model,
                    max_tokens=max_tokens,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )

            except anthropic.RateLimitError:
                if attempt == self.MAX_RETRIES:
                    raise
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s
                logger.warning(
                    f"Rate limit (429). Reintento {attempt}/{self.MAX_RETRIES} en {wait}s"
                )
                time.sleep(wait)

            except anthropic.InternalServerError:
                if attempt == self.MAX_RETRIES:
                    raise
                wait = 2 ** (attempt - 1)
                logger.warning(
                    f"Server error (500/529). Reintento {attempt}/{self.MAX_RETRIES} en {wait}s"
                )
                time.sleep(wait)

            except anthropic.APIStatusError:
                # Otros errores HTTP (400, 401, 403, etc) no son temporales
                raise

        # P-01 FIX: Safety net. Si el loop termina sin return ni raise,
        # Python retorna None implicitamente. Despues, response.usage.input_tokens
        # lanza AttributeError con un mensaje confuso. Este raise lo hace explicito.
        raise RuntimeError(
            f"_call_with_retry: loop terminó tras {self.MAX_RETRIES} intentos sin resultado"
        )

    def _get_usage_from_db(self) -> int:
        """Consulta tokens totales usados hoy desde api_usage.

        FAIL-OPEN: Si la DB esta caida, retorna 0 y loguea error.
        Razon: preferimos permitir una llamada (y gastar unos tokens)
        a bloquear el servicio entero porque la DB esta temporalmente caida.
        Anthropic tiene sus propios limites como red de seguridad adicional.
        """
        try:
            with get_db_connection_no_tenant() as conn:
                result = conn.execute(
                    "SELECT COALESCE(SUM(tokens_total), 0) "
                    "FROM api_usage WHERE usage_date = CURRENT_DATE",
                ).fetchone()
                return int(result[0])
        except Exception as exc:
            logger.error(
                f"No se pudo consultar api_usage (FAIL-OPEN, permitiendo llamada): {exc}"
            )
            return 0

    def _record_usage(
        self,
        tokens_input: int,
        tokens_output: int,
        tokens_total: int,
        cost_usd: Decimal,
    ) -> None:
        """Registra uso en api_usage. Si falla → log CRITICAL, no detiene.

        Esta en el bloque finally de generate_message(), asi que se ejecuta
        SIEMPRE: si la llamada fue exitosa, si fallo, o si se supero el limite.
        """
        try:
            with get_db_connection_no_tenant() as conn:
                conn.execute(
                    """
                    INSERT INTO api_usage (
                        usage_date, tokens_input, tokens_output,
                        tokens_total, cost_usd
                    ) VALUES (
                        CURRENT_DATE, %(input)s, %(output)s,
                        %(total)s, %(cost)s
                    )
                    """,
                    {
                        'input': tokens_input,
                        'output': tokens_output,
                        'total': tokens_total,
                        'cost': float(cost_usd),
                    },
                )
                conn.commit()
        except Exception as exc:
            logger.critical(
                f"FALLO CRITICO: No se pudo registrar uso en api_usage: {exc}. "
                f"Tokens: {tokens_total}, Costo: ${cost_usd:.6f} USD"
            )
