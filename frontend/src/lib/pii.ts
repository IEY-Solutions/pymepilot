const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Captures common phone formats with at least 10 digits:
// +54 9 11 2345 6789, 11-1234-5678, (011) 1234-5678, etc.
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{1,4}\)?[-.\s]?)*\d{3,4}[-.\s]?\d{4}/g;

// Argentine DNI: 7-8 digits with optional dot separators (e.g. 12345678 or 12.345.678).
const DNI_PATTERN = /\b\d{1,2}[.]?\d{3}[.]?\d{3}\b/g;

export const NOTE_PREVIEW_MAX_LENGTH = 150;

/**
 * Truncates `text` to `maxLength` characters, adding an ellipsis when truncated.
 */
export function truncateText(text: string | null, maxLength: number): string | null {
  if (text === null) return null;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

/**
 * Redacts PII-like patterns (email, phone, DNI) from a note text.
 *
 * DNI is redacted before phone so that 7-8 digit identity numbers are not
 * mistaken for phone numbers.
 */
export function redactPii(text: string | null): string | null {
  if (text === null) return null;
  return text
    .replace(EMAIL_PATTERN, '[EMAIL]')
    .replace(DNI_PATTERN, '[DNI]')
    .replace(PHONE_PATTERN, '[PHONE]');
}
