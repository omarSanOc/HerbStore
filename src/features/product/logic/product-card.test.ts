/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CatalogProduct, ProductBadge } from '../contracts/catalog-product.ts';
import { buildProductCardModel, getProductBadge } from './product-card.ts';

const plain = (text: string | undefined) => text?.replace(/ | /g, ' ');

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
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
  it('shows the price in the preferred currency, in the format of the interface language', () => {
    const mxn = product({ price: 277.9, currency: 'MXN' });

    assert.equal(plain(buildProductCardModel(mxn, 'es', 'MXN').price), '$277.90');
    assert.equal(plain(buildProductCardModel(mxn, 'en', 'MXN').price), 'MX$277.90');
    assert.equal(plain(buildProductCardModel(mxn, 'es', 'USD').price), 'USD 15.44');
    assert.equal(plain(buildProductCardModel(mxn, 'en', 'USD').price), '$15.44');
  });

  it('converts a USD product to the preferred currency at 1 USD = 18 MXN', () => {
    const usd = product({ price: 11.99, currency: 'USD' });

    assert.equal(plain(buildProductCardModel(usd, 'es', 'MXN').price), '$215.82');
    assert.equal(plain(buildProductCardModel(usd, 'en', 'MXN').price), 'MX$215.82');
    // Same currency: the amount is shown as it came, with no round trip.
    assert.equal(plain(buildProductCardModel(usd, 'es', 'USD').price), 'USD 11.99');
    assert.equal(plain(buildProductCardModel(usd, 'en', 'USD').price), '$11.99');
  });

  it('the price of origin never decides the displayed currency (the preference does)', () => {
    for (const currency of ['MXN', 'USD'] as const) {
      const fromMxn = buildProductCardModel(product({ price: 360, currency: 'MXN' }), 'en', currency);
      const fromUsd = buildProductCardModel(product({ price: 20, currency: 'USD' }), 'en', currency);

      // 360 MXN and 20 USD are the same canonical value, so they read the same in either view.
      assert.equal(fromMxn.price, fromUsd.price);
    }
  });

  it('carries the struck-through list price only for a real offer, converted like the price', () => {
    const offer = buildProductCardModel(product({ price: 210.9, listPrice: 253.08 }), 'es', 'MXN');
    assert.equal(offer.badge, 'offer');
    assert.equal(plain(offer.listPrice), '$253.08');

    const inUsd = buildProductCardModel(product({ price: 360, listPrice: 540 }), 'es', 'USD');
    assert.equal(plain(inUsd.price), 'USD 20.00');
    assert.equal(plain(inUsd.listPrice), 'USD 30.00');

    const regular = buildProductCardModel(product(), 'es', 'USD');
    assert.equal(regular.listPrice, undefined);
  });

  it('decides the offer badge from the prices of origin, whatever the preferred currency', () => {
    for (const currency of ['MXN', 'USD'] as const) {
      assert.equal(buildProductCardModel(product({ price: 360, listPrice: 540 }), 'en', currency).badge, 'offer');
      assert.equal(buildProductCardModel(product({ price: 360, listPrice: 360 }), 'en', currency).badge, undefined);
    }
  });

  it('formats rating and review count', () => {
    const model = buildProductCardModel(product({ rating: 4.9, reviewCount: 1234 }), 'en', 'MXN');
    assert.deepEqual(model.rating, { value: '4.9', count: 1234, countText: '1,234' });
  });

  it('has no rating without reviews', () => {
    assert.equal(
      buildProductCardModel(product({ rating: 0, reviewCount: 0 }), 'en', 'MXN').rating,
      undefined,
    );
  });

  it('reports availability so the card can say it in text, not only in color', () => {
    assert.equal(buildProductCardModel(product({ inStock: true }), 'es', 'MXN').inStock, true);
    assert.equal(buildProductCardModel(product({ inStock: false }), 'es', 'USD').inStock, false);
  });

  it('keeps the name as catalog data', () => {
    assert.equal(buildProductCardModel(product({ name: 'Zinc 25 mg' }), 'en', 'USD').name, 'Zinc 25 mg');
  });

  it('does not mutate the product', () => {
    const input = product({ listPrice: 300, ...badges('NEW') });
    const snapshot = structuredClone(input);
    buildProductCardModel(input, 'es', 'USD');
    assert.deepEqual(input, snapshot);
  });
});
