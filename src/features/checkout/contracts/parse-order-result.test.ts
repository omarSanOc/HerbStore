/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseOrderResult } from './parse-order-result.ts';

describe('parseOrderResult', () => {
  it('projects a confirmed order to its id and drops everything else', () => {
    const payload = {
      status: 'confirmed',
      order: {
        id: 'order-1',
        items: [{ productId: 'p1', quantity: 2, unitPrice: 10, lineTotal: 20 }],
        currency: 'MXN',
        subtotal: 20,
        shipping: 0,
        total: 20,
        status: 'confirmed',
        createdAt: '2026-10-12T00:00:00.000Z',
      },
    };

    assert.deepEqual(parseOrderResult(payload, 200), {
      status: 'confirmed', orderId: 'order-1',
      summary: { id: 'order-1', items: [{ productId: 'p1', quantity: 2, unitPrice: 10, lineTotal: 20 }], currency: 'MXN', subtotal: 20, shipping: 0, total: 20, createdAt: '2026-10-12T00:00:00.000Z' },
    });
  });

  it('projects a pending answer to its retry delay and drops the echoed key', () => {
    assert.deepEqual(parseOrderResult({ status: 'pending', retryAfterSeconds: 1, key: 'dev-1' }, 202), {
      status: 'pending',
      retryAfterSeconds: 1,
    });
  });

  it('rejects anything that is not exactly one of the two known answers', () => {
    const invalid: unknown[] = [
      undefined,
      null,
      'confirmed',
      [],
      {},
      { status: 'unknown' },
      { status: 'confirmed' },
      { status: 'confirmed', order: null },
      { status: 'confirmed', order: {} },
      { status: 'confirmed', order: { id: '' } },
      { status: 'confirmed', order: { id: 7 } },
      { status: 'pending' },
      { status: 'pending', retryAfterSeconds: 0 },
      { status: 'pending', retryAfterSeconds: -1 },
      { status: 'pending', retryAfterSeconds: 1.5 },
      { status: 'pending', retryAfterSeconds: '1' },
      { status: 'pending', retryAfterSeconds: Number.POSITIVE_INFINITY },
    ];

    for (const payload of invalid) {
      assert.equal(parseOrderResult(payload), undefined, JSON.stringify(payload));
    }
  });
});
