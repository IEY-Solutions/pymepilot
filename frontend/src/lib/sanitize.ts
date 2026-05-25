/**
 * Limpieza de texto para interpolacion en prompts de Claude.
 *
 * QUE HACE (y que NO hace):
 * Limpia caracteres de control, trunca el texto, y elimina secuencias de
 * formato que pueden confundir la estructura del prompt (```, """).
 *
 * IMPORTANTE — LIMITACION CONOCIDA:
 * Esta funcion NO previene prompt injection semantica. Ataques en lenguaje
 * natural como "Ignora las instrucciones anteriores" siguen pasando.
 * La defensa real contra prompt injection esta en el PATRON DEL PROMPT:
 * el texto del usuario se encapsula en etiquetas XML <nota_vendedor>...</nota_vendedor>
 * que el modelo interpreta como datos, no como instrucciones.
 * Ver: pipeline/route.ts donde se usa esta funcion.
 *
 * CONCEPTO - Prompt Injection:
 * Es cuando un atacante incluye instrucciones en el input que el modelo
 * interpreta como si fueran ordenes del sistema. La defensa en capas:
 * 1. Limpieza de formato (esta funcion) — elimina ruido estructural
 * 2. Encapsulado XML en el prompt — separa datos de instrucciones
 * La combinacion de ambas capas reduce significativamente el riesgo.
 */

// Maximo de caracteres permitidos en texto que se interpola en prompts
const MAX_PROMPT_TEXT_LENGTH = 500;

/**
 * Sanitiza un string para uso seguro en prompts de Claude.
 *
 * Operaciones:
 * 1. Truncar a MAX_PROMPT_TEXT_LENGTH caracteres
 * 2. Eliminar caracteres de control (ASCII 0-31, excepto tab y newline)
 * 3. Eliminar caracteres que se usan tipicamente en prompt injection:
 *    - "```" (bloques de codigo que confunden la estructura del prompt)
 *    - Secuencias de triple comillas
 * 4. Normalizar espacios multiples
 */
export function sanitizeForPrompt(text: string): string {
  // Paso 1: truncar
  let sanitized = text.slice(0, MAX_PROMPT_TEXT_LENGTH);

  // Paso 2: eliminar caracteres de control (excepto \t y \n que son validos en notas)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Paso 3: escapar caracteres XML para que el usuario no pueda romper el encapsulado
  // <nota_vendedor>. Si alguien escribe "</nota_vendedor>", el < se convierte en &lt;
  // y la etiqueta queda sellada. El orden importa: & primero para no doble-escapar.
  sanitized = sanitized.replace(/&/g, "&amp;");
  sanitized = sanitized.replace(/</g, "&lt;");
  sanitized = sanitized.replace(/>/g, "&gt;");

  // Paso 4: eliminar secuencias de prompt injection conocidas
  sanitized = sanitized.replace(/```/g, "");
  sanitized = sanitized.replace(/"""/g, "");

  // Paso 5: normalizar multiples espacios/newlines consecutivos
  sanitized = sanitized.replace(/[ \t]{3,}/g, "  ");
  sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

  return sanitized.trim();
}
