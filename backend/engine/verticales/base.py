"""
Clase base para todas las verticales de prediccion de PymePilot.

QUE HACE ESTE ARCHIVO:
Define el "esqueleto" de como funciona una vertical. Cada vertical
(Reposicion, Activacion, Cross-sell, Recuperacion) hereda de esta
base y solo implementa las partes que cambian.

CONCEPTO CLAVE - Template Method Pattern:
Imagina una receta de cocina con pasos fijos:
  1. Buscar ingredientes (candidatos)
  2. Preparar (calcular confianza, prioridad, perfil)
  3. Cocinar (llamar a Claude)
  4. Emplatar (guardar prediccion)

Los pasos son siempre los mismos, pero cada plato (vertical) usa
ingredientes distintos. Esta clase define LOS PASOS. Cada vertical
define LOS INGREDIENTES.

CONCEPTO CLAVE - Clase Abstracta:
Los metodos marcados con @abstractmethod son como "huecos" que cada
vertical DEBE rellenar. Si no los implementa, Python da error.
Los metodos SIN @abstractmethod ya tienen una logica por defecto
que las verticales pueden cambiar si quieren (pero no estan obligadas).

FLUJO DEL TEMPLATE METHOD (run):
  1. Cargar prompt template desde archivo .txt
  2. Obtener candidatos (abstracto — cada vertical los busca distinto)
  3. Para cada candidato:
     a. Obtener contexto (abstracto)
     b. Calcular confianza (abstracto)
     c. Si confianza < minimo → saltar
     d. Calcular prioridad y perfil
     e. Generar mensaje con Claude (o saltar en dry-run)
     f. Guardar prediccion en DB
  4. Retornar resumen
"""

from abc import ABC, abstractmethod
from datetime import date
from pathlib import Path

from backend.engine.claude.client import ClaudeClient, DailyLimitExceeded
from backend.engine.core.logger import get_logger, sanitize_text
from backend.engine.db.connection import get_db_connection, get_db_connection_no_tenant
from backend.engine.db.queries import (
    check_existing_prediction,
    get_revenue_percentile_threshold,
    get_run_summary,
    save_prediction,
)

logger = get_logger(__name__)

# Directorio donde estan los templates de prompts
_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / 'config' / 'prompts'


class VerticalBase(ABC):
    """Clase base para verticales de prediccion.

    Subclases DEBEN implementar:
      - vertical_name (str): 'reposicion', 'activacion', etc.
      - prompt_file (str): nombre del archivo .txt en config/prompts/
      - get_candidates(): como buscar candidatos
      - get_context(): que datos extra necesita cada candidato
      - calculate_confidence(): como medir la confianza (0.0 a 1.0)
      - build_prompt_data(): como armar los placeholders del prompt
      - calculate_contact_date(): cuando contactar al cliente

    Subclases PUEDEN sobreescribir (tienen default):
      - calculate_priority(): como asignar prioridad (1 a 5)
      - classify_profile(): como clasificar VIP/Regular/etc
      - build_suggested_products(): como formatear productos para DB
      - build_metadata(): que metadata guardar con la prediccion
      - max_tokens_response: tokens max para la respuesta de Claude
    """

    # --- Atributos que la subclase DEBE definir ---
    vertical_name: str
    prompt_file: str

    # --- Atributos configurables (override opcional) ---
    max_tokens_response: int = 300  # Un mensaje de WhatsApp no necesita mas

    def __init__(self) -> None:
        self._prompt_system: str | None = None
        self._prompt_user: str | None = None
        self._claude_client: ClaudeClient | None = None
        self._tenant_name: str = ''

    # ================================================================
    # TEMPLATE METHOD — El esqueleto del algoritmo
    # ================================================================

    def run(
        self,
        tenant_slug: str,
        dry_run: bool = False,
        limit: int | None = None,
        min_confidence: float = 0.0,
    ) -> dict:
        """Ejecuta la vertical completa para un tenant.

        Este es el TEMPLATE METHOD: define los pasos en orden fijo.
        Las subclases rellenan los "huecos" (metodos abstractos).

        Args:
            tenant_slug: Slug del tenant (ej: 'iey').
            dry_run: Si True, ejecuta todo EXCEPTO llamar a Claude.
                Util para verificar candidatos, scores y perfiles
                sin gastar tokens.
            limit: Maximo de candidatos a procesar (None = todos).
            min_confidence: Score minimo para generar prediccion (0.0 a 1.0).

        Returns:
            dict con 'stats' (contadores) y 'results' (detalle por candidato).
        """
        # --- Paso 1: Setup ---
        self._load_prompt()

        if not dry_run:
            self._claude_client = ClaudeClient()

        # Obtener tenant_id y nombre
        from backend.engine.db.connection import get_tenant_id_by_slug
        tenant_id = get_tenant_id_by_slug(tenant_slug)

        with get_db_connection(tenant_id) as conn:
            row = conn.execute(
                "SELECT name FROM tenants WHERE id = %s", (tenant_id,)
            ).fetchone()
            self._tenant_name = row[0] if row else tenant_slug

        logger.info(
            f"=== {self.vertical_name.upper()} iniciado para "
            f"'{self._tenant_name}' ({tenant_slug}) | "
            f"dry_run={dry_run}, limit={limit}, min_confidence={min_confidence} ==="
        )

        # --- Paso 2: Obtener candidatos y umbral VIP ---
        with get_db_connection(tenant_id) as conn:
            candidates = self.get_candidates(conn, tenant_id)
            vip_threshold = get_revenue_percentile_threshold(conn, tenant_id)

        if limit:
            candidates = candidates[:limit]

        logger.info(
            f"Candidatos: {len(candidates)} "
            f"(umbral VIP: ${vip_threshold:,.2f})"
        )

        if not candidates:
            logger.info("Sin candidatos. Nada que procesar.")
            return {'stats': self._empty_stats(), 'results': []}

        # --- Paso 3: Procesar cada candidato ---
        stats = {
            'processed': 0,
            'skipped_low_confidence': 0,
            'skipped_dedup': 0,
            'failed': 0,
            'total_cost': 0.0,
            'stopped_by_limit': False,
        }
        results = []

        for candidate in candidates:
            try:
                result = self._process_candidate(
                    tenant_id=tenant_id,
                    candidate=candidate,
                    vip_threshold=vip_threshold,
                    dry_run=dry_run,
                    min_confidence=min_confidence,
                )

                if result is None:
                    # Saltado por confianza baja o dedup
                    pass  # El contador se actualiza dentro de _process_candidate
                elif result == 'skipped_confidence':
                    stats['skipped_low_confidence'] += 1
                elif result == 'skipped_dedup':
                    stats['skipped_dedup'] += 1
                else:
                    results.append(result)
                    stats['processed'] += 1
                    stats['total_cost'] += result.get('cost_usd', 0)

            except DailyLimitExceeded:
                logger.warning(
                    "Limite diario de tokens alcanzado. "
                    "Deteniendo procesamiento de candidatos."
                )
                stats['stopped_by_limit'] = True
                break

            except Exception as exc:
                stats['failed'] += 1
                logger.error(
                    f"Error procesando candidato "
                    f"'{candidate.get('name', '?')}': {sanitize_text(str(exc))}",
                    exc_info=True,
                )

        # --- Paso 4: Resumen ---
        logger.info(
            f"=== {self.vertical_name.upper()} completado: "
            f"{stats['processed']} procesados, "
            f"{stats['skipped_low_confidence']} baja confianza, "
            f"{stats['skipped_dedup']} dedup, "
            f"{stats['failed']} fallidos, "
            f"costo total ${stats['total_cost']:.6f} USD ==="
        )

        return {'stats': stats, 'results': results}

    # ================================================================
    # PROCESAMIENTO DE UN CANDIDATO
    # ================================================================

    def _process_candidate(
        self,
        tenant_id: str,
        candidate: dict,
        vip_threshold: float,
        dry_run: bool,
        min_confidence: float,
    ) -> dict | str | None:
        """Procesa un candidato individual: contexto → confianza → mensaje → save.

        Returns:
            dict con detalle si se proceso OK.
            'skipped_confidence' si confianza < minimo.
            'skipped_dedup' si ya tiene prediccion activa.
        """
        customer_name = candidate.get('name', '?')
        customer_id = str(candidate['customer_id'])

        with get_db_connection(tenant_id) as conn:
            # --- Dedup check (belt-and-suspenders sobre el UNIQUE index) ---
            if check_existing_prediction(
                conn, tenant_id, customer_id,
                self.vertical_name, date.today(),
            ):
                logger.debug(f"Dedup: {customer_name} ya tiene prediccion activa")
                return 'skipped_dedup'

            # --- Obtener contexto ---
            context = self.get_context(conn, tenant_id, candidate)

            # --- Calcular confianza ---
            confidence = self.calculate_confidence(candidate, context)
            confidence = max(0.0, min(1.0, confidence))  # Clamp 0-1

            if confidence < min_confidence:
                logger.debug(
                    f"Saltado: {customer_name} | "
                    f"confidence={confidence:.2f} < min={min_confidence:.2f}"
                )
                return 'skipped_confidence'

            # --- Prioridad y perfil ---
            priority = self.calculate_priority(candidate, confidence)
            priority = max(1, min(5, priority))  # Clamp 1-5
            profile = self.classify_profile(candidate, vip_threshold)

            # --- Generar mensaje ---
            message_text = None
            cost_usd = 0.0

            if dry_run:
                logger.info(
                    f"[DRY-RUN] {customer_name} | "
                    f"confidence={confidence:.2f} | priority={priority} | "
                    f"profile={profile}"
                )
            else:
                prompt_data = self.build_prompt_data(
                    candidate, context, profile,
                )
                result = self._generate_message(prompt_data)
                message_text = result['text']
                cost_usd = result['cost_usd']

                logger.info(
                    f"Mensaje generado: {customer_name} | "
                    f"confidence={confidence:.2f} | priority={priority} | "
                    f"profile={profile} | ${cost_usd:.6f}"
                )

            # --- Construir datos para guardar ---
            suggested_products = self.build_suggested_products(context)
            metadata = self.build_metadata(
                candidate, context, profile, confidence,
            )
            contact_date = self.calculate_contact_date(candidate)

            # --- Guardar prediccion ---
            prediction_id = save_prediction(
                conn=conn,
                tenant_id=tenant_id,
                customer_id=customer_id,
                vertical=self.vertical_name,
                prediction_date=date.today(),
                contact_date=contact_date,
                message_text=message_text,
                suggested_products=suggested_products,
                confidence_score=round(confidence, 2),
                priority=priority,
                metadata=metadata,
            )
            conn.commit()

        return {
            'prediction_id': prediction_id,
            'customer_name': customer_name,
            'confidence': round(confidence, 2),
            'priority': priority,
            'profile': profile,
            'message_preview': (message_text or '[DRY-RUN]')[:100],
            'cost_usd': cost_usd,
        }

    # ================================================================
    # METODOS CONCRETOS (la base los maneja)
    # ================================================================

    def _load_prompt(self) -> None:
        """Lee y parsea el template de prompt desde archivo .txt.

        El archivo usa ===SYSTEM=== y ===USER=== como separadores.
        """
        path = _PROMPTS_DIR / self.prompt_file
        content = path.read_text(encoding='utf-8')

        parts = content.split('===USER===')
        if len(parts) != 2:
            raise ValueError(
                f"Prompt template {self.prompt_file} debe tener "
                f"exactamente un separador ===USER===. Encontrados: {len(parts) - 1}"
            )

        self._prompt_system = parts[0].replace('===SYSTEM===', '').strip()
        self._prompt_user = parts[1].strip()

        logger.debug(f"Prompt template cargado: {self.prompt_file}")

    def _generate_message(self, prompt_data: dict) -> dict:
        """Rellena el template y llama a Claude.

        Args:
            prompt_data: Dict con todos los placeholders del prompt.
                Debe incluir todos los {campos} del template.

        Returns:
            Dict de ClaudeClient: text, tokens_input, tokens_output,
            tokens_total, cost_usd.
        """
        system = self._prompt_system.format(
            distributor_name=self._tenant_name,
        )
        user = self._prompt_user.format(**prompt_data)

        return self._claude_client.generate_message(
            system_prompt=system,
            user_prompt=user,
            max_tokens=self.max_tokens_response,
        )

    @staticmethod
    def _empty_stats() -> dict:
        """Stats vacios para cuando no hay candidatos."""
        return {
            'processed': 0,
            'skipped_low_confidence': 0,
            'skipped_dedup': 0,
            'failed': 0,
            'total_cost': 0.0,
            'stopped_by_limit': False,
        }

    # ================================================================
    # METODOS ABSTRACTOS (la subclase DEBE implementar)
    # ================================================================

    @abstractmethod
    def get_candidates(self, conn, tenant_id: str) -> list[dict]:
        """Retorna lista de candidatos para esta vertical.

        Cada vertical busca candidatos de forma diferente:
        - Reposicion: clientes proximos a necesitar recompra
        - Activacion: clientes nuevos que no hicieron segunda compra
        - Recuperacion: clientes inactivos hace mucho tiempo
        """
        ...

    @abstractmethod
    def get_context(self, conn, tenant_id: str, candidate: dict) -> dict:
        """Obtiene datos adicionales para un candidato especifico.

        El contexto es la informacion extra que necesita el prompt:
        productos que compra, historial detallado, etc.
        """
        ...

    @abstractmethod
    def calculate_confidence(self, candidate: dict, context: dict) -> float:
        """Calcula el score de confianza de la prediccion (0.0 a 1.0).

        Cada vertical tiene sus propios factores de confianza.
        Reposicion usa: regularidad, cantidad de datos, recencia,
        tendencia, y antiguedad de la relacion.
        """
        ...

    @abstractmethod
    def build_prompt_data(
        self, candidate: dict, context: dict, profile: str,
    ) -> dict:
        """Construye el dict con placeholders para el prompt.

        Retorna un dict con TODOS los {campos} que aparecen en
        la seccion ===USER=== del template de prompt.
        """
        ...

    @abstractmethod
    def calculate_contact_date(self, candidate: dict) -> date | None:
        """Calcula la fecha sugerida para contactar al cliente.

        Reposicion usa la predicted_date (fecha estimada de recompra).
        Otras verticales pueden usar logica diferente.
        """
        ...

    # ================================================================
    # METODOS CON DEFAULT (la subclase PUEDE sobreescribir)
    # ================================================================

    def calculate_priority(self, candidate: dict, confidence: float) -> int:
        """Asigna prioridad de 1 (maxima) a 5 (minima).

        Default: combina confianza con valor de negocio.
        - Confianza alta + facturacion alta → prioridad 1
        - Confianza baja + facturacion baja → prioridad 5

        La subclase puede sobreescribir con logica mas especifica.
        """
        amount = float(candidate.get('total_purchases_amount', 0))

        # Score de valor (0-1) basado en facturacion
        # Usamos un tope de $500,000 como referencia razonable
        value_score = min(amount / 500_000, 1.0)

        # Combinacion: 60% confianza + 40% valor
        combined = (confidence * 0.6) + (value_score * 0.4)

        # Mapear a prioridad 1-5 (invertido: mayor combined = menor numero)
        if combined >= 0.8:
            return 1
        elif combined >= 0.6:
            return 2
        elif combined >= 0.4:
            return 3
        elif combined >= 0.2:
            return 4
        else:
            return 5

    def classify_profile(self, candidate: dict, vip_threshold: float) -> str:
        """Clasifica al cliente en un perfil para variar el tono del mensaje.

        Perfiles:
        - VIP: facturacion en el top 20% (>= vip_threshold)
        - En riesgo: ultima compra hace mas de 1.5x su avg_days
        - Nuevo-recurrente: exactamente 2 compras (acaba de repetir)
        - Regular: todos los demas

        La subclase puede sobreescribir con logica mas especifica.
        """
        amount = float(candidate.get('total_purchases_amount', 0))
        count = candidate.get('total_purchases_count', 0)
        avg_days = float(candidate.get('avg_days_between_purchases') or 0)
        days_until = candidate.get('days_until_predicted', 0)

        # VIP: top 20% por facturacion
        if vip_threshold > 0 and amount >= vip_threshold:
            return 'VIP'

        # En riesgo: muy atrasado respecto a su ritmo normal
        if avg_days > 0 and days_until < -(avg_days * 0.5):
            return 'En riesgo'

        # Nuevo-recurrente: segunda compra (acaba de convertirse en recurrente)
        if count == 2:
            return 'Nuevo-recurrente'

        return 'Regular'

    def build_suggested_products(self, context: dict) -> list[dict]:
        """Formatea productos para el campo suggested_products (JSONB).

        Default: toma los productos del contexto y arma una lista
        simplificada con nombre, cantidad promedio, y precio.
        """
        products = context.get('products', [])
        return [
            {
                'product_id': str(p.get('product_id', '')),
                'product_name': p.get('product_name', ''),
                'avg_quantity': int(p.get('avg_quantity') or 0),
                'last_ordered': str(p.get('last_ordered', '')),
            }
            for p in products[:6]  # Maximo 6 productos
        ]

    def build_metadata(
        self,
        candidate: dict,
        context: dict,
        profile: str,
        confidence: float,
    ) -> dict:
        """Construye metadata adicional para guardar con la prediccion.

        Default: incluye perfil, factores de confianza, y datos
        para la secuencia de seguimiento (preparada para iteracion 2).
        """
        return {
            'profile': profile,
            'confidence_score': round(confidence, 3),
            'vertical_version': 'v2.0',
            # Preparado para secuencia de seguimiento (iteracion 2)
            'sequence_step': 1,
            'sequence_id': None,  # Se genera cuando se implemente seguimiento
        }
