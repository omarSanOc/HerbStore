/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseProductId } from './parse-product-id.ts';

describe('parseProductId', () => {
  it('accepts ids with the generated catalog shape', () => {
    assert.equal(parseProductId('product-261009-001'), 'product-261009-001');
    assert.equal(parseProductId('product-261009-300'), 'product-261009-300');
  });

  it('accepts well-formed ids that may not exist (existence is the server concern)', () => {
    assert.equal(parseProductId('product-261009-999'), 'product-261009-999');
    assert.equal(parseProductId('product-000000-000'), 'product-000000-000');
  });

  it('rejects missing values', () => {
    assert.equal(parseProductId(undefined), undefined);
    assert.equal(parseProductId(null), undefined);
    assert.equal(parseProductId(''), undefined);
  });

  it('rejects repeated route params (arrays) and other non-string values', () => {
    assert.equal(parseProductId(['product-261009-001']), undefined);
    assert.equal(parseProductId(['product-261009-001', 'product-261009-002']), undefined);
    assert.equal(parseProductId(261009001), undefined);
    assert.equal(parseProductId({ id: 'product-261009-001' }), undefined);
  });

  it('rejects surrounding or inner whitespace, including a trailing newline', () => {
    assert.equal(parseProductId(' '), undefined);
    assert.equal(parseProductId(' product-261009-001'), undefined);
    assert.equal(parseProductId('product-261009-001 '), undefined);
    assert.equal(parseProductId('product-261009-001\n'), undefined);
    assert.equal(parseProductId('product- 261009-001'), undefined);
  });

  it('rejects wrong digit counts', () => {
    assert.equal(parseProductId('product-26100-001'), undefined);
    assert.equal(parseProductId('product-2610090-001'), undefined);
    assert.equal(parseProductId('product-261009-01'), undefined);
    assert.equal(parseProductId('product-261009-0001'), undefined);
  });

  it('rejects wrong prefix, case and separators', () => {
    assert.equal(parseProductId('Product-261009-001'), undefined);
    assert.equal(parseProductId('item-261009-001'), undefined);
    assert.equal(parseProductId('product_261009_001'), undefined);
    assert.equal(parseProductId('product-261009001'), undefined);
  });

  it('rejects characters that could alter the request path or query', () => {
    assert.equal(parseProductId('product-261009-001/../health'), undefined);
    assert.equal(parseProductId('product-261009-001?fail=true'), undefined);
    assert.equal(parseProductId('product-261009-001#x'), undefined);
    assert.equal(parseProductId('product-261009-00%31'), undefined);
  });

  it('rejects non-ASCII digits and absurdly long input', () => {
    assert.equal(parseProductId('product-２６１００９-００１'), undefined);
    assert.equal(parseProductId(`product-261009-001${'0'.repeat(10_000)}`), undefined);
  });
});
