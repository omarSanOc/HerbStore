import assert from 'node:assert/strict';
import test from 'node:test';

import { createScannerReadBarrier } from './scanner-read-barrier.ts';

test('consecutive barcode callbacks in the same render claim only one attempt', () => {
  const barrier = createScannerReadBarrier();
  barrier.rearm();

  const firstAttempt = barrier.claim();
  const secondAttempt = barrier.claim();

  assert.equal(firstAttempt, 1);
  assert.equal(secondAttempt, undefined);
});

test('a new callback is accepted only after an explicit rearm', () => {
  const barrier = createScannerReadBarrier();
  barrier.rearm();
  assert.equal(barrier.claim(), 1);
  assert.equal(barrier.claim(), undefined);

  barrier.rearm();
  assert.equal(barrier.claim(), 2);
});

test('an invalid callback consumes the current attempt before a valid callback can query', () => {
  const barrier = createScannerReadBarrier();
  barrier.rearm();
  const queries: string[] = [];
  const onBarcodeScanned = (code: string) => {
    if (barrier.claim() === undefined) return;
    if (code.length === 13) queries.push(code);
  };

  onBarcodeScanned('invalid');
  onBarcodeScanned('4006381333931');

  assert.deepEqual(queries, []);
});
