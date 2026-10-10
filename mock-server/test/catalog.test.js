import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATALOG_SEED,
  generateCatalog,
} from '../src/catalog/generate-catalog.js';
import { normalizeText } from '../src/catalog/normalize-text.js';

const ALLOWED_BADGES = new Set([
  'BEST_SELLER',
  'QUALITY_PICK',
  'NEW',
  'OWN_BRAND',
]);
const ALLOWED_CURRENCIES = new Set(['MXN', 'USD']);

function hasValidEan13Checksum(ean13) {
  if (!/^\d{13}$/.test(ean13)) {
    return false;
  }

  const digits = [...ean13].map(Number);
  const weightedSum = digits
    .slice(0, 12)
    .reduce(
      (sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3),
      0,
    );
  const expectedCheckDigit = (10 - (weightedSum % 10)) % 10;

  return digits[12] === expectedCheckDigit;
}

describe('deterministic catalog generation', () => {
  it('creates the same 300 products for the fixed seed', () => {
    const firstCatalog = generateCatalog(CATALOG_SEED);
    const secondCatalog = generateCatalog(CATALOG_SEED);

    assert.equal(firstCatalog.length, 300);
    assert.equal(secondCatalog.length, 300);
    assert.deepEqual(secondCatalog, firstCatalog);
    assert.deepEqual(
      secondCatalog.map(({ id, ean13 }) => ({ id, ean13 })),
      firstCatalog.map(({ id, ean13 }) => ({ id, ean13 })),
    );
  });

  it('produces unique ids and valid unique EAN-13 values', () => {
    const catalog = generateCatalog(CATALOG_SEED);
    const ids = new Set(catalog.map((product) => product.id));
    const ean13Values = new Set(catalog.map((product) => product.ean13));

    assert.equal(ids.size, 300);
    assert.equal(ean13Values.size, 300);
    assert.ok(catalog.every(({ ean13 }) => hasValidEan13Checksum(ean13)));
  });

  it('satisfies every product invariant', () => {
    const catalog = generateCatalog(CATALOG_SEED);
    let productsWithCoupon = 0;
    let productsWithListPrice = 0;

    for (const product of catalog) {
      assert.equal(typeof product.id, 'string');
      assert.ok(product.id.length > 0);
      assert.equal(typeof product.brand, 'string');
      assert.ok(product.brand.length > 0);
      assert.equal(typeof product.name, 'string');
      assert.ok(product.name.length > 0);
      assert.equal(typeof product.categoryId, 'string');
      assert.ok(product.categoryId.length > 0);
      assert.equal(typeof product.subcategoryId, 'string');
      assert.ok(product.subcategoryId.length > 0);
      assert.ok(Number.isFinite(product.price) && product.price > 0);
      assert.ok(ALLOWED_CURRENCIES.has(product.currency));
      assert.ok(product.rating >= 0 && product.rating <= 5);
      assert.ok(Number.isInteger(product.rating * 10));
      assert.ok(Number.isInteger(product.reviewCount) && product.reviewCount >= 0);
      assert.ok(
        Number.isInteger(product.soldLast30Days) &&
          product.soldLast30Days >= 0,
      );
      assert.ok(Array.isArray(product.badges));
      assert.ok(product.badges.every((badge) => ALLOWED_BADGES.has(badge)));
      assert.equal(new Set(product.badges).size, product.badges.length);
      assert.equal(typeof product.inStock, 'boolean');
      assert.equal(typeof product.isOwnBrand, 'boolean');
      assert.equal(typeof product.subscribeAndSave, 'boolean');
      assert.ok(Array.isArray(product.images) && product.images.length > 0);
      assert.ok(product.images.every((image) => typeof image === 'string'));
      assert.equal(typeof product.servingInfo.size, 'string');
      assert.ok(product.servingInfo.size.length > 0);
      assert.ok(
        Number.isInteger(product.servingInfo.servingsPerContainer) &&
          product.servingInfo.servingsPerContainer > 0,
      );
      assert.equal(typeof product.description, 'string');
      assert.ok(product.description.length > 0);

      if (product.listPrice !== undefined) {
        productsWithListPrice += 1;
        assert.ok(product.listPrice > product.price);
      }

      if (product.couponText !== undefined) {
        productsWithCoupon += 1;
        assert.equal(typeof product.couponText, 'string');
        assert.ok(product.couponText.length > 0);
      }

      if (product.isOwnBrand) {
        assert.ok(product.badges.includes('OWN_BRAND'));
      }
    }

    assert.ok(productsWithCoupon > 0);
    assert.ok(productsWithListPrice > 0);
  });
});

describe('search text normalization', () => {
  it('is case, accent, and repeated-whitespace insensitive', () => {
    assert.equal(normalizeText('  ÁRBOL   Verde\tCON Limón  '), 'arbol verde con limon');
  });

  it('returns the same result when applied more than once', () => {
    const normalized = normalizeText('  Fórmula   HERBAL  ');

    assert.equal(normalizeText(normalized), normalized);
  });
});
