/// <reference types="node" />
// RF-17–RF-20, RF-33, RF-34 (spec 007, T4). What the order-status screen shows after EACH consult,
// as a pure rule over the settled answer and the local attempt — the same shape as
// `classifyHomeResult` and `classifyFacetQueryState`, so the matrix is testable without UI:
//
// - Only the contractual pairs (200+confirmed, 202+pending) ever produce `confirmed`/`pending`
//   from an answer; every other input keeps the base `unresolved` view or shows a safe
//   `offline`/`error` line. Releasing the attempt is the machine's job (`attempt-machine`), never
//   this rule's: a 422, a 5xx or an incompatible body changes what the SCREEN says, and nothing
//   else — the lock is persisted, not the message (RF-33, RF-38).
//
// Android: a `sealed interface OrderStatusUiState` produced by the ViewModel. SwiftUI: an enum
// with associated values (`.pending(retryAfter:)`) rendered by one `switch`.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from '../../../core/api/api-error.ts';
import type { OrderResult } from '../contracts/order.ts';
import { classifyOrderStatusView, type ActiveAttempt, type OrderStatusSnapshot } from './order-status-view-state.ts';

const attempt = (remoteStatus?: 'pending'): ActiveAttempt =>
  remoteStatus === undefined
    ? { status: 'unresolved', key: 'key-0001', fingerprint: 'fp' }
    : { status: 'unresolved', key: 'key-0001', fingerprint: 'fp', remoteStatus };

const CONFIRMED: OrderResult = { status: 'confirmed', orderId: 'order-0001' };
const PENDING: OrderResult = { status: 'pending', retryAfterSeconds: 3 };

function view(partial: Partial<OrderStatusSnapshot> = {}, local = attempt()) {
  const snapshot: OrderStatusSnapshot = { data: undefined, error: undefined, isFetching: false, ...partial };
  return classifyOrderStatusView({ attempt: local, snapshot });
}

const status = (partial: Partial<OrderStatusSnapshot> = {}, local = attempt()) => view(partial, local).status;

describe('classifyOrderStatusView: while the consult runs (RF-33)', () => {
  it('is loading while the consult is in flight with no settled answer', () => {
    assert.deepEqual(view({ isFetching: true }), { status: 'loading' });
  });

  it('is loading while a retry runs, even with a settled failure waiting (no failure blink)', () => {
    assert.equal(status({ isFetching: true, error: { kind: 'network' } }), 'loading');
  });

  it('is loading while it re-asks, even if an earlier answer said pending', () => {
    assert.equal(status({ isFetching: true, data: PENDING }), 'loading');
  });
});

describe('classifyOrderStatusView: only the contractual pairs say pending or confirmed (RF-17, RF-20)', () => {
  it('200 + confirmed -> confirmed', () => {
    assert.equal(status({ data: CONFIRMED }), 'confirmed');
  });

  it('202 + pending -> pending, carrying retryAfterSeconds for the wait line', () => {
    assert.deepEqual(view({ data: PENDING }), { status: 'pending', retryAfterSeconds: 3 });
  });

  it('pending persisted from an earlier 202, with no answer yet -> pending without invented seconds', () => {
    assert.deepEqual(view({}, attempt('pending')), { status: 'pending' });
  });

  it('an answer object that does not honour the pair contract -> error, never confirmed', () => {
    // Callers that bypassed the parser (RF-20): none of these is one of the RF-17/RF-19 pairs.
    const broken = [
      { status: 'confirmed' },            // confirmed without its order id
      { status: 'confirmed', orderId: '' }, // and with an empty one
      { status: 'pending', retryAfterSeconds: 0 }, // 202 needs at least one second (RF-19)
      { status: 'processing' },           // a status this contract does not know
    ] as unknown as OrderResult[];
    for (const data of broken) assert.equal(status({ data }), 'error', JSON.stringify(data));
  });

  it('a settled contract answer wins over a stale failure sitting beside it', () => {
    assert.equal(status({ data: CONFIRMED, error: { kind: 'network' } }), 'confirmed');
  });
});

describe('classifyOrderStatusView: transport and answers outside the contract (RF-33, RF-34)', () => {
  it('network (no response at all) -> offline', () => {
    assert.equal(status({ error: { kind: 'network' } }), 'offline');
  });

  it('timeout, invalid body, 5xx and unknown 4xx -> error', () => {
    for (const error of [
      { kind: 'timeout' },
      { kind: 'invalid' },
      { kind: 'http', status: 500, body: { kind: 'inconsistent' } },
      { kind: 'http', status: 503, body: { kind: 'inconsistent' } },
      // 422 unexpected: a 4xx the order contract does not know (RF-34) — a safe error, no replay.
      { kind: 'http', status: 422, body: { kind: 'inconsistent' } },
      { kind: 'http', status: 418, body: { kind: 'inconsistent' } },
      // A contract STATUS with a body that does not pair with it: incompatible (RF-20).
      { kind: 'http', status: 404, body: { kind: 'inconsistent' } },
      // The http error lost its parsed body on the way: never trusted as a contract pair.
      { kind: 'http', status: 409 },
    ] satisfies ApiError[]) {
      assert.equal(status({ error }), 'error', JSON.stringify(error));
    }
  });

  it('404 not_created, 410 expired, 409 key_reused and 400 validation are contract answers: the base view stays', () => {
    for (const error of [
      { kind: 'http', status: 404, body: { kind: 'notCreated' } },
      { kind: 'http', status: 410, body: { kind: 'expired' } },
      { kind: 'http', status: 409, body: { kind: 'keyReused' } },
      { kind: 'http', status: 400, body: { kind: 'validation' } },
      { kind: 'http', status: 409, body: { kind: 'outOfStock' } },
    ] satisfies ApiError[]) {
      assert.equal(status({ error }), 'unresolved', JSON.stringify(error));
      assert.equal(status({ error }, attempt('pending')), 'pending', JSON.stringify(error));
    }
  });

  it('aborted is a cancellation, not a failure: the base view (or the persisted pending) remains', () => {
    assert.equal(status({ error: { kind: 'aborted' } }), 'unresolved');
    assert.equal(status({ error: { kind: 'aborted' } }, attempt('pending')), 'pending');
  });
});

describe('classifyOrderStatusView: nothing settled yet (RF-33)', () => {
  it('a plain unresolved (or preliminary) attempt shows the base view', () => {
    assert.equal(status(), 'unresolved');
    assert.equal(status({}, { status: 'preliminary', key: 'key-0001', fingerprint: 'fp' }), 'unresolved');
  });

  it('never reports empty or stale: there is no such state for an order (RF-33)', () => {
    const known = new Set(['loading', 'pending', 'confirmed', 'offline', 'error', 'unresolved']);
    for (const snapshot of [
      {},
      { isFetching: true },
      { data: PENDING },
      { error: { kind: 'network' } },
      { error: { kind: 'http', status: 500 } },
    ] satisfies Partial<OrderStatusSnapshot>[]) {
      assert.ok(known.has(status(snapshot)), JSON.stringify(snapshot));
    }
  });

  it('invariant: no failure input ever reads as confirmed, and none of them reads as a fresh pending', () => {
    const failures: ApiError[] = [
      { kind: 'network' },
      { kind: 'timeout' },
      { kind: 'invalid' },
      { kind: 'aborted' },
      { kind: 'http', status: 422, body: { kind: 'inconsistent' } },
      { kind: 'http', status: 500, body: { kind: 'inconsistent' } },
      { kind: 'http', status: 404, body: { kind: 'inconsistent' } },
    ];
    for (const error of failures) {
      const result = view({ error });
      assert.notEqual(result.status, 'confirmed', JSON.stringify(error));
      assert.ok(result.status !== 'pending' || result.retryAfterSeconds === undefined, JSON.stringify(error));
    }
  });
});
