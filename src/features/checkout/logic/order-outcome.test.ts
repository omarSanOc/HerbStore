/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ApiError } from '../../../core/api/api-error.ts';
import { parseOrderOutcome, validationFieldsOf } from './order-outcome.ts';

describe('parseOrderOutcome', () => {
  it('maps data, contract errors and transport errors without exposing bodies', () => {
    assert.equal(parseOrderOutcome({ data: { status: 'pending', retryAfterSeconds: 1 } }), 'pending');
    assert.equal(parseOrderOutcome({ error: { kind: 'http', status: 409, body: { kind: 'keyReused' } } }), 'keyReused');
    assert.equal(parseOrderOutcome({ error: { kind: 'timeout' } }), 'uncertain');
  });

  // T2 (RF-17). Table of every way a request can end. The rule under test: only a parsed 200
  // `confirmed` is ever `confirmed`; anything the app cannot read is `uncertain`, never a guess.
  type Case = readonly [label: string, input: Parameters<typeof parseOrderOutcome>[0], expected: string];
  const confirmed = { status: 'confirmed', orderId: 'order-1' } as const;
  const cases: readonly Case[] = [
    ['200 confirmed', { data: confirmed }, 'confirmed'],
    ['202 pending', { data: { status: 'pending', retryAfterSeconds: 2 } }, 'pending'],
    ['400 validation', { error: { kind: 'http', status: 400, body: { kind: 'validation', fields: {} } } }, 'validation'],
    ['409 out of stock', { error: { kind: 'http', status: 409, body: { kind: 'outOfStock' } } }, 'outOfStock'],
    ['409 key reused', { error: { kind: 'http', status: 409, body: { kind: 'keyReused', statusPath: '/orders/status/k' } } }, 'keyReused'],
    ['404 not created', { error: { kind: 'http', status: 404, body: { kind: 'notCreated' } } }, 'notCreated'],
    ['410 expired', { error: { kind: 'http', status: 410, body: { kind: 'expired' } } }, 'expired'],
    ['4xx body the contract rejected', { error: { kind: 'http', status: 409, body: { kind: 'inconsistent' } } }, 'inconsistent'],
    ['503 without a readable body', { error: { kind: 'http', status: 503 } }, 'uncertain'],
    ['404 without a readable body', { error: { kind: 'http', status: 404 } }, 'uncertain'],
    ['body that is not an object', { error: { kind: 'http', status: 500, body: 'oops' } }, 'uncertain'],
    ['body without a kind', { error: { kind: 'http', status: 500, body: {} } }, 'uncertain'],
    ['body with a non-text kind', { error: { kind: 'http', status: 500, body: { kind: 7 } } }, 'uncertain'],
    ['offline (network)', { error: { kind: 'network' } }, 'uncertain'],
    ['timeout', { error: { kind: 'timeout' } }, 'uncertain'],
    ['2xx with an invalid body', { error: { kind: 'invalid' } }, 'uncertain'],
    ['aborted', { error: { kind: 'aborted' } }, 'uncertain'],
    ['neither data nor error', {}, 'uncertain'],
  ];

  for (const [label, input, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      assert.equal(parseOrderOutcome(input), expected);
    });
  }

  it('no transport failure and no status without a body can read as confirmed', () => {
    const errors: readonly ApiError[] = [
      { kind: 'network' },
      { kind: 'timeout' },
      { kind: 'invalid' },
      { kind: 'aborted' },
      ...[200, 201, 202, 400, 404, 409, 410, 500, 503].map((status) => ({ kind: 'http' as const, status })),
    ];
    for (const error of errors) {
      assert.notEqual(parseOrderOutcome({ error }), 'confirmed', JSON.stringify(error));
    }
  });

  it('data wins over a stale error, as the thunk passes only one of them', () => {
    assert.equal(parseOrderOutcome({ data: confirmed, error: { kind: 'timeout' } }), 'confirmed');
  });
});

// T3b (RF-17, 400 message). The screen needs the server's paths to point at a field; it must never
// receive anything else of the body.
describe('validationFieldsOf', () => {
  it('returns the paths and codes of a 400 validation error', () => {
    const error: ApiError = { kind: 'http', status: 400, body: { kind: 'validation', fields: { 'shippingAddress.phone': 'INVALID_FORMAT' } } };
    assert.deepEqual(validationFieldsOf(error), { 'shippingAddress.phone': 'INVALID_FORMAT' });
  });

  it('is undefined for every other failure, unreadable body or non-error value', () => {
    const others: readonly unknown[] = [
      { kind: 'http', status: 409, body: { kind: 'outOfStock' } },
      { kind: 'http', status: 400 },
      { kind: 'http', status: 400, body: { kind: 'validation' } },
      { kind: 'http', status: 400, body: { kind: 'validation', fields: 'phone' } },
      { kind: 'network' },
      new Error('boom'),
      undefined,
      null,
      'validation',
    ];
    for (const error of others) assert.equal(validationFieldsOf(error), undefined, JSON.stringify(error));
  });
});
