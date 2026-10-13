/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ApiError } from './api-error.ts';
import { MAX_AUTOMATIC_RETRIES, retryDelayMs, shouldRetryRequest } from './retry-policy.ts';

const network: ApiError = { kind: 'network' };
const http = (status: number): ApiError => ({ kind: 'http', status });

describe('shouldRetryRequest', () => {
  it('retries GET on network and 5xx at attempts 1 and 2, never at 3', () => {
    for (const method of ['GET', undefined] as const) {
      for (const error of [network, http(500), http(503)]) {
        assert.equal(shouldRetryRequest({ error, attempt: 1, method, maxRetries: 2 }), true);
        assert.equal(shouldRetryRequest({ error, attempt: 2, method, maxRetries: 2 }), true);
        assert.equal(shouldRetryRequest({ error, attempt: 3, method, maxRetries: 2 }), false);
      }
    }
  });

  it('recognizes GET regardless of case', () => {
    assert.equal(shouldRetryRequest({ error: network, attempt: 1, method: 'get', maxRetries: 2 }), true);
  });

  it('never retries a 4xx', () => {
    for (const status of [400, 404, 409]) {
      for (const attempt of [1, 2, 3]) {
        assert.equal(
          shouldRetryRequest({ error: http(status), attempt, method: 'GET', maxRetries: 2 }),
          false,
        );
      }
    }
  });

  it('never retries aborted', () => {
    for (const attempt of [1, 2, 3]) {
      assert.equal(
        shouldRetryRequest({ error: { kind: 'aborted' }, attempt, method: 'GET', maxRetries: 2 }),
        false,
      );
    }
  });

  it('never retries timeout or invalid (P3)', () => {
    for (const kind of ['timeout', 'invalid'] as const) {
      for (const attempt of [1, 2, 3]) {
        assert.equal(
          shouldRetryRequest({ error: { kind }, attempt, method: 'GET', maxRetries: 2 }),
          false,
        );
      }
    }
  });

  it('never retries a POST, whatever the error (P2: createOrder does 0)', () => {
    for (const error of [network, http(503), http(500)]) {
      assert.equal(shouldRetryRequest({ error, attempt: 1, method: 'POST', maxRetries: 2 }), false);
    }
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      assert.equal(shouldRetryRequest({ error: network, attempt: 1, method, maxRetries: 2 }), false);
    }
  });

  it('never retries with maxRetries 0', () => {
    for (const error of [network, http(503)]) {
      assert.equal(shouldRetryRequest({ error, attempt: 1, method: 'GET', maxRetries: 0 }), false);
    }
  });

  it('exposes exactly two automatic retries', () => {
    assert.equal(MAX_AUTOMATIC_RETRIES, 2);
  });
});

describe('retryDelayMs', () => {
  it('waits 500 ms before the first retry and 1000 ms before the second', () => {
    assert.equal(retryDelayMs(1), 500);
    assert.equal(retryDelayMs(2), 1000);
  });

  it('grows strictly with every attempt', () => {
    for (let attempt = 1; attempt < 6; attempt += 1) {
      assert.ok(retryDelayMs(attempt + 1) > retryDelayMs(attempt));
    }
  });
});
