/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseOrderError } from './parse-order-error.ts';

describe('parseOrderError', () => {
  const key = 'attempt-abcdef';
  it('accepts the five contractual pairs and removes message', () => {
    assert.deepEqual(parseOrderError(400, { error: { code: 'VALIDATION_ERROR', message: 'secret' }, fields: { 'shippingAddress.phone': 'INVALID_FORMAT' } }, key), { kind: 'validation', fields: { 'shippingAddress.phone': 'INVALID_FORMAT' } });
    assert.deepEqual(parseOrderError(409, { error: { code: 'OUT_OF_STOCK', message: 'secret' } }, key), { kind: 'outOfStock' });
    assert.deepEqual(parseOrderError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: `/orders/status/${encodeURIComponent(key)}` } }, key), { kind: 'keyReused', statusPath: `/orders/status/${encodeURIComponent(key)}` });
    assert.deepEqual(parseOrderError(404, { status: 'not_created', error: { code: 'ORDER_NOT_CREATED' } }, key), { kind: 'notCreated' });
    assert.deepEqual(parseOrderError(410, { status: 'expired', error: { code: 'IDEMPOTENCY_KEY_EXPIRED' } }, key), { kind: 'expired' });
  });
  it('rejects a link for another key and every inconsistent pair', () => {
    assert.equal(parseOrderError(409, { error: { code: 'IDEMPOTENCY_KEY_REUSED' }, links: { status: '/orders/status/other' } }, key).kind, 'inconsistent');
    assert.equal(parseOrderError(404, { status: 'expired', error: { code: 'ORDER_NOT_CREATED' } }, key).kind, 'inconsistent');
  });
});
