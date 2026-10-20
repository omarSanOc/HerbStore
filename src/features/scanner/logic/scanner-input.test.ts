import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeScannerInput } from './scanner-input.ts';

const VALID = '2002610090004';

test('normalizes a QR payload by trimming only its external whitespace', () => {
  assert.deepEqual(normalizeScannerInput({ type: 'qr', data: `  ${VALID}\n` }), {
    kind: 'valid',
    format: 'qr',
    code: VALID,
  });
});

test('keeps direct EAN-13 input strict and distinguishes its format', () => {
  assert.deepEqual(normalizeScannerInput({ type: 'ean13', data: VALID }), {
    kind: 'valid',
    format: 'ean13',
    code: VALID,
  });
  assert.deepEqual(normalizeScannerInput(VALID), {
    kind: 'valid',
    format: 'ean13',
    code: VALID,
  });
  assert.equal(normalizeScannerInput({ type: 'ean13', data: ` ${VALID}` }).kind, 'invalid');
});

test('rejects malformed QR payloads and non-product payloads locally', () => {
  const invalidInputs = [
    '',
    '123456789012',
    '2002610090001',
    '20026100900A4',
    '200261 0090004',
    'https://example.test/products/1',
    'product-261009-004',
    'herbstore://scanner/product-261009-004',
    'not a product code',
  ];

  for (const data of invalidInputs) {
    assert.deepEqual(normalizeScannerInput({ type: 'qr', data }), { kind: 'invalid' });
  }
});

test('rejects barcode formats outside the configured EAN-13 and QR contract', () => {
  assert.deepEqual(normalizeScannerInput({ type: 'code128', data: VALID }), { kind: 'invalid' });
});
