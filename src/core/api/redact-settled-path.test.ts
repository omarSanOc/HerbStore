/// <reference types="node" />
// RF-38 (spec 007, T4). The dev log prints `METHOD path -> outcome` for every attempt, and one path
// in the app carries a secret: `GET /orders/status/:key` puts the FULL Idempotency-Key in the URL.
// This is the unit test of the redaction the base query applies before anything can print: the
// masked tail (the same `…last4` the order log uses) keeps "these two consults shared a key"
// observable without ever logging it in full — no key, no body, no address.
//
// The integration proof that no log line ever contains the key/address/body lives in
// `checkout-thunks.test.tsx` (RF-38: "the log of an attempt").
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redactSettledPath } from './redact-settled-path.ts';

describe('redactSettledPath', () => {
  it('masks the idempotency key of a status consult, keeping only its last 4 characters', () => {
    assert.equal(redactSettledPath('/orders/status/dev-mgx3k2f9-0a1b2c3d'), '/orders/status/…2c3d');
    assert.equal(redactSettledPath('/orders/status/key-0001'), '/orders/status/…0001');
    // Same key, same masked line: "these two consults were for the attempt" stays observable.
    assert.equal(redactSettledPath('/orders/status/key-0001'), redactSettledPath('/orders/status/key-0001'));
    assert.notEqual(redactSettledPath('/orders/status/dev-a-00000001'), redactSettledPath('/orders/status/dev-b-00000002'));
  });

  it('never reveals a short key in full', () => {
    assert.equal(redactSettledPath('/orders/status/abcd'), '/orders/status/…');
    assert.equal(redactSettledPath('/orders/status/a'), '/orders/status/…');
    assert.equal(redactSettledPath('/orders/status/'), '/orders/status/');
  });

  it('leaves every other path exactly as it arrived (no query strings ever reach the log)', () => {
    for (const path of ['/orders', '/products', '/products/product-261009-001', '/health',
      '/home/es', '/orders/status', '/orders/confirmations', '/brands']) {
      assert.equal(redactSettledPath(path), path);
    }
  });

  it('masks an encoded key after decoding it, whatever the segment contains', () => {
    assert.equal(redactSettledPath('/orders/status/a%2Fb%2Fsecret'), '/orders/status/…cret');
  });
});
