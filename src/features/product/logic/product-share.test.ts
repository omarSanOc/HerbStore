/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeIncomingUrl } from '../../../core/navigation/linking.ts';
import { buildProductShareUrl } from './product-share.ts';

describe('buildProductShareUrl', () => {
  it('builds the app deep link of the product', () => {
    assert.equal(buildProductShareUrl('product-261009-043'), 'herbstore://product/product-261009-043');
  });

  it('builds a link that the deep link normalizer routes back to the same product', () => {
    for (const id of ['product-261009-001', 'product-261009-043', 'product-261009-300']) {
      const url = buildProductShareUrl(id);

      assert.ok(url !== undefined);
      assert.equal(normalizeIncomingUrl(url), `/product/${id}`);
    }
  });

  it('never builds a link for an id that is not catalog shaped', () => {
    for (const id of ['', 'product-1', 'x', ' product-261009-043', 'product-261009-043/../x', 'product-261009-0431']) {
      assert.equal(buildProductShareUrl(id), undefined, id);
    }
    assert.equal(buildProductShareUrl(undefined as unknown as string), undefined);
  });
});
