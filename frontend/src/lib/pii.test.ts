import { describe, it, expect } from 'vitest';
import { truncateText, redactPii } from './pii';

describe('truncateText', () => {
  it('returns null when the input is null', () => {
    expect(truncateText(null, 150)).toBeNull();
  });

  it('returns short text unchanged', () => {
    expect(truncateText('short', 150)).toBe('short');
  });

  it('truncates long text to the maximum length with an ellipsis', () => {
    const long = 'a'.repeat(200);
    const result = truncateText(long, 150);
    expect(result).toHaveLength(150);
    expect(result?.endsWith('…')).toBe(true);
  });
});

describe('redactPii', () => {
  it('returns null when the input is null', () => {
    expect(redactPii(null)).toBeNull();
  });

  it('redacts email addresses', () => {
    const result = redactPii('Contactame a juan@example.com por favor');
    expect(result).toBe('Contactame a [EMAIL] por favor');
  });

  it('redacts phone numbers', () => {
    const result = redactPii('Llama al 11-1234-5678 o al +54 9 11 2345 6789');
    expect(result).toBe('Llama al [PHONE] o al [PHONE]');
  });

  it('redacts argentine DNI numbers', () => {
    const result = redactPii('DNI 12.345.678 del cliente');
    expect(result).toBe('DNI [DNI] del cliente');
  });
});
