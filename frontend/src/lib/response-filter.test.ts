import { describe, it, expect, vi } from 'vitest';
import { filterResponse } from './response-filter';

describe('filterResponse', () => {
  it('keeps only top-level allowlisted fields', () => {
    const data = {
      id: 'card-1',
      tenant_id: 'tenant-1',
      prediction_id: 'pred-1',
      column_name: 'a_contactar',
    };

    const result = filterResponse(data, ['id', 'column_name']);

    expect(result).toEqual({
      id: 'card-1',
      column_name: 'a_contactar',
    });
  });

  it('filters nested objects using dot notation', () => {
    const data = {
      id: 'card-1',
      customer: {
        id: 'cust-1',
        name: 'Acme',
        email: 'acme@example.com',
        phone: '+5491112345678',
      },
    };

    const result = filterResponse(data, ['id', 'customer.name']);

    expect(result).toEqual({
      id: 'card-1',
      customer: { name: 'Acme' },
    });
  });

  it('filters each item in an array', () => {
    const data = {
      cards: [
        { id: 'c1', tenant_id: 't1', column_name: 'contactado' },
        { id: 'c2', tenant_id: 't2', column_name: 'vendido' },
      ],
    };

    const result = filterResponse(data, ['cards.id', 'cards.column_name']);

    expect(result).toEqual({
      cards: [
        { id: 'c1', column_name: 'contactado' },
        { id: 'c2', column_name: 'vendido' },
      ],
    });
  });

  it('keeps a full subtree when the parent path is allowlisted', () => {
    const data = {
      id: 'card-1',
      metadata: { stock_alert: { products_without_stock: ['A'] } },
    };

    const result = filterResponse(data, ['id', 'metadata']);

    expect(result).toEqual({
      id: 'card-1',
      metadata: { stock_alert: { products_without_stock: ['A'] } },
    });
  });

  it('returns primitives untouched when allowlisted', () => {
    const result = filterResponse('hello', []);
    expect(result).toBe('hello');
  });

  it('invokes onStripped with the path of each removed field', () => {
    const onStripped = vi.fn();
    const data = {
      id: 'card-1',
      tenant_id: 'tenant-1',
      customer: { name: 'Acme', email: 'acme@example.com' },
    };

    filterResponse(data, ['id', 'customer.name'], { onStripped });

    expect(onStripped).toHaveBeenCalledWith('tenant_id');
    expect(onStripped).toHaveBeenCalledWith('customer.email');
  });
});
