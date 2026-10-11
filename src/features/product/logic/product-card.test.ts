/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { HomeProduct, ProductBadge } from '../../home/contracts/home.ts';
import { buildProductCardModel, getProductBadge } from './product-card.ts';

const plain = (text: string | undefined) => text?.replace(/ | /g, ' ');

function product(overrides: Partial<HomeProduct> = {}): HomeProduct {
  return {
    id: 'product-261009-001',
    brand: 'AsterVale Nutrition',
    name: 'Complete Daily Powder',
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 277.9,
    currency: 'MXN',
    rating: 4.9,
    reviewCount: 1234,
    soldLast30Days: 10,
    badges: [],
    inStock: true,
    images: ['/images/products/product-001-front.png'],
    ...overrides,
  };
}

const badges = (...values: ProductBadge[]) => ({ badges: values });

describe('getProductBadge', () => {
  it('shows no badge when nothing applies', () => {
    assert.equal(getProductBadge(product()), undefined);
    assert.equal(getProductBadge(product(badges('QUALITY_PICK', 'OWN_BRAND'))), undefined);
  });

  it('offer wins over new and best seller', () => {
    assert.equal(
      getProductBadge(product({ listPrice: 300, ...badges('NEW', 'BEST_SELLER') })),
      'offer',
    );
  });

  it('new wins over best seller', () => {
    assert.equal(getProductBadge(product(badges('BEST_SELLER', 'NEW'))), 'new');
  });

  it('shows best seller when it is the only applicable badge', () => {
    assert.equal(getProductBadge(product(badges('QUALITY_PICK', 'BEST_SELLER'))), 'best_seller');
  });

  it('ignores a list price that is not higher than the price (not a real discount)', () => {
    assert.equal(getProductBadge(product({ listPrice: 277.9 })), undefined);
    assert.equal(getProductBadge(product({ listPrice: 100, ...badges('NEW') })), 'new');
  });

  it('never uses the coupon text', () => {
    assert.equal(getProductBadge(product({ couponText: 'Save 10% at checkout' })), undefined);
  });
});

describe('buildProductCardModel', () => {
  it('formats the price with the currency of the product, not the language', () => {
    const mxn = buildProductCardModel(product({ price: 277.9, currency: 'MXN' }), 'es');
    const usd = buildProductCardModel(product({ price: 11.99, currency: 'USD' }), 'es');

    assert.equal(plain(mxn.price), '$277.90');
    assert.equal(plain(usd.price), 'USD 11.99');
    assert.equal(plain(buildProductCardModel(product({ price: 11.99, currency: 'USD' }), 'en').price), '$11.99');
    assert.equal(plain(buildProductCardModel(product({ price: 277.9, currency: 'MXN' }), 'en').price), 'MX$277.90');
  });

  it('carries the struck-through list price only for a real offer', () => {
    const offer = buildProductCardModel(product({ price: 210.9, listPrice: 253.08 }), 'es');
    assert.equal(offer.badge, 'offer');
    assert.equal(plain(offer.listPrice), '$253.08');

    const regular = buildProductCardModel(product(), 'es');
    assert.equal(regular.listPrice, undefined);
  });

  it('formats rating and review count', () => {
    const model = buildProductCardModel(product({ rating: 4.9, reviewCount: 1234 }), 'en');
    assert.deepEqual(model.rating, { value: '4.9', count: 1234, countText: '1,234' });
  });

  it('has no rating without reviews', () => {
    assert.equal(buildProductCardModel(product({ rating: 0, reviewCount: 0 }), 'en').rating, undefined);
  });

  it('keeps the name as catalog data', () => {
    assert.equal(buildProductCardModel(product({ name: 'Zinc 25 mg' }), 'en').name, 'Zinc 25 mg');
  });

  it('does not mutate the product', () => {
    const input = product({ listPrice: 300, ...badges('NEW') });
    const snapshot = structuredClone(input);
    buildProductCardModel(input, 'es');
    assert.deepEqual(input, snapshot);
  });
});
