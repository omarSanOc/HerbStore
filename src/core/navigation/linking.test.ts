/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeIncomingUrl, redirectSystemPath } from './linking.ts';

const PRODUCT = 'product-261009-001';

describe('normalizeIncomingUrl', () => {
  describe('product links', () => {
    it('maps a valid product link to its in-app path', () => {
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}`), `/product/${PRODUCT}`);
    });

    it('accepts the three-slash form some launchers produce', () => {
      assert.equal(normalizeIncomingUrl(`herbstore:///product/${PRODUCT}`), `/product/${PRODUCT}`);
    });

    it('drops query string, fragment and trailing slash', () => {
      const expected = `/product/${PRODUCT}`;
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}?utm=x&fail=true`), expected);
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}#section`), expected);
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}/?a=1#b`), expected);
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}/`), expected);
    });

    it('treats scheme and host as case-insensitive but keeps the id exact', () => {
      assert.equal(
        normalizeIncomingUrl(`HerbStore://PRODUCT/${PRODUCT}`),
        `/product/${PRODUCT}`,
      );
      // An upper-cased id is not a catalog id: it must reach the not-found state.
      assert.equal(
        normalizeIncomingUrl(`herbstore://product/${PRODUCT.toUpperCase()}`),
        '/product/invalid',
      );
    });

    it('routes a malformed or missing id to the not-found state without echoing the input', () => {
      assert.equal(normalizeIncomingUrl('herbstore://product/not-a-product'), '/product/invalid');
      assert.equal(normalizeIncomingUrl('herbstore://product/'), '/product/invalid');
      assert.equal(normalizeIncomingUrl('herbstore://product'), '/product/invalid');
      assert.equal(normalizeIncomingUrl('herbstore://product?x=1'), '/product/invalid');
      assert.equal(normalizeIncomingUrl('herbstore://product/..%2Fhealth'), '/product/invalid');
      assert.equal(normalizeIncomingUrl(`herbstore://product/${PRODUCT}%0A`), '/product/invalid');
    });

    it('keeps a well-formed id that may not exist (existence is the server concern)', () => {
      assert.equal(
        normalizeIncomingUrl('herbstore://product/product-261009-999'),
        '/product/product-261009-999',
      );
    });

    it('does not treat extra path segments as a product destination', () => {
      const result = normalizeIncomingUrl(`herbstore://product/${PRODUCT}/reviews`);
      assert.notEqual(result, `/product/${PRODUCT}`);
      assert.equal(result, `/product/${PRODUCT}/reviews`);
    });
  });

  describe('root', () => {
    it('maps the root URL to "/"', () => {
      assert.equal(normalizeIncomingUrl('herbstore:///'), '/');
      assert.equal(normalizeIncomingUrl('herbstore://'), '/');
      assert.equal(normalizeIncomingUrl('herbstore:/'), '/');
      assert.equal(normalizeIncomingUrl('herbstore:///?x=1#y'), '/');
    });

    it('maps a bare "/" path to "/"', () => {
      assert.equal(normalizeIncomingUrl('/'), '/');
    });
  });

  describe('foreign and unusable input', () => {
    it('ignores other schemes (including the dev client launcher URL)', () => {
      assert.equal(normalizeIncomingUrl('https://example.com/product/product-261009-001'), null);
      assert.equal(normalizeIncomingUrl('http://localhost:8081'), null);
      assert.equal(normalizeIncomingUrl('exp://127.0.0.1:8081'), null);
      assert.equal(
        normalizeIncomingUrl('exp+herbstore://expo-development-client/?url=http%3A%2F%2Fx'),
        null,
      );
      assert.equal(normalizeIncomingUrl('myapp://product/product-261009-001'), null);
      assert.equal(normalizeIncomingUrl('herbstore-evil://product/product-261009-001'), null);
    });

    it('ignores empty and non-string input without throwing', () => {
      assert.equal(normalizeIncomingUrl(''), null);
      assert.equal(normalizeIncomingUrl('   '), null);
      assert.equal(normalizeIncomingUrl(undefined as unknown as string), null);
      assert.equal(normalizeIncomingUrl(null as unknown as string), null);
      assert.equal(normalizeIncomingUrl(42 as unknown as string), null);
    });
  });

  describe('unknown hosts', () => {
    it('passes an unknown host through as a path so the router shows +not-found', () => {
      assert.equal(normalizeIncomingUrl('herbstore://unknown'), '/unknown');
      assert.equal(normalizeIncomingUrl('herbstore://unknown/42?x=1#f'), '/unknown/42');
      assert.equal(normalizeIncomingUrl('herbstore://Unknown/'), '/unknown');
    });

    it('collapses repeated slashes', () => {
      assert.equal(normalizeIncomingUrl('herbstore://unknown//a///b'), '/unknown/a/b');
    });
  });

  describe('plain in-app paths', () => {
    it('normalizes a bare product path the same way as the full URL', () => {
      assert.equal(normalizeIncomingUrl(`/product/${PRODUCT}?x=1`), `/product/${PRODUCT}`);
      assert.equal(normalizeIncomingUrl('/product/nope'), '/product/invalid');
    });
  });
});

describe('redirectSystemPath', () => {
  it('delegates to normalizeIncomingUrl for initial and later links', () => {
    assert.equal(
      redirectSystemPath({ path: `herbstore://product/${PRODUCT}`, initial: true }),
      `/product/${PRODUCT}`,
    );
    assert.equal(
      redirectSystemPath({ path: `herbstore://product/${PRODUCT}`, initial: false }),
      `/product/${PRODUCT}`,
    );
  });

  it('maps the normal cold-start URL to the root', () => {
    assert.equal(redirectSystemPath({ path: 'herbstore:///', initial: true }), '/');
  });

  it('returns null for foreign links', () => {
    assert.equal(redirectSystemPath({ path: 'https://example.com', initial: false }), null);
  });

  it('never throws, even with malformed events', () => {
    assert.doesNotThrow(() => redirectSystemPath(undefined as never));
    assert.doesNotThrow(() => redirectSystemPath(null as never));
    assert.doesNotThrow(() => redirectSystemPath({} as never));
    assert.equal(redirectSystemPath({ path: 123 as never, initial: false }), null);
    assert.equal(redirectSystemPath(undefined as never), null);
  });
});
