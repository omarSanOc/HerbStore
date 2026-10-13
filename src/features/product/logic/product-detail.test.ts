/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ProductDetail } from '../contracts/catalog-product.ts';
import { buildProductDetailModel } from './product-detail.ts';

// `Intl` separates "USD" from the number with a no-break space (U+00A0, or U+202F in some ICU
// versions); the expectations below use a plain space.
const plain = (text: string | undefined) => text?.replace(/[\u00a0\u202f]/g, ' ');

const base: ProductDetail = {
  id: 'product-261009-043',
  brand: 'AsterVale Nutrition',
  name: 'Zinc Capsules',
  categoryId: 'minerals',
  subcategoryId: 'zinc',
  price: 277.9,
  currency: 'MXN',
  rating: 4.2,
  reviewCount: 1234,
  soldLast30Days: 5,
  badges: [],
  inStock: true,
  images: ['/images/products/product-043-front.png', '/images/products/product-043-detail.png'],
  description: 'Zinc in a capsules format for a simple daily wellness routine.',
  servingInfo: { size: '2 capsules', servingsPerContainer: 60 },
  stock: 99,
};

const usdProduct: ProductDetail = { ...base, price: 11.99, currency: 'USD' };

describe('buildProductDetailModel: identity', () => {
  it('carries the texts and the pictures of the product untouched', () => {
    const model = buildProductDetailModel(base, 'es', 'MXN', 1);

    assert.equal(model.brand, 'AsterVale Nutrition');
    assert.equal(model.name, 'Zinc Capsules');
    assert.equal(model.description, 'Zinc in a capsules format for a simple daily wellness routine.');
    assert.deepEqual(model.images, base.images);
  });

  it('formats the serving with a localized count of servings per container', () => {
    const es = buildProductDetailModel({ ...base, servingInfo: { size: '1 tablet', servingsPerContainer: 1200 } }, 'es', 'MXN', 1);
    const en = buildProductDetailModel({ ...base, servingInfo: { size: '1 tablet', servingsPerContainer: 1200 } }, 'en', 'MXN', 1);

    assert.deepEqual(es.serving, { size: '1 tablet', servingsPerContainer: 1200, countText: '1,200' });
    assert.deepEqual(en.serving, { size: '1 tablet', servingsPerContainer: 1200, countText: '1,200' });
  });

  it('shows the rating only when there are reviews (a 0.0 would mislead)', () => {
    assert.deepEqual(buildProductDetailModel(base, 'es', 'MXN', 1).rating, {
      value: '4.2',
      count: 1234,
      countText: '1,234',
    });
    assert.equal(buildProductDetailModel({ ...base, reviewCount: 0, rating: 0 }, 'es', 'MXN', 1).rating, undefined);
  });
});

describe('buildProductDetailModel: prices in the preferred currency (RF-5)', () => {
  it('shows an MXN product in MXN without converting it', () => {
    assert.equal(plain(buildProductDetailModel(base, 'es', 'MXN', 1).price), '$277.90');
    assert.equal(plain(buildProductDetailModel(base, 'en', 'MXN', 1).price), 'MX$277.90');
  });

  it('converts an MXN product to USD at 1 USD = 18 MXN', () => {
    assert.equal(plain(buildProductDetailModel(base, 'es', 'USD', 1).price), 'USD 15.44');
    assert.equal(plain(buildProductDetailModel(base, 'en', 'USD', 1).price), '$15.44');
  });

  it('converts a USD product to MXN and keeps it in USD', () => {
    assert.equal(plain(buildProductDetailModel(usdProduct, 'es', 'MXN', 1).price), '$215.82');
    assert.equal(plain(buildProductDetailModel(usdProduct, 'es', 'USD', 1).price), 'USD 11.99');
  });

  it('shows the list price only for a real offer, converted like the price', () => {
    const offer = buildProductDetailModel({ ...base, listPrice: 333.48 }, 'es', 'MXN', 1);
    const offerInUsd = buildProductDetailModel({ ...base, listPrice: 333.48 }, 'es', 'USD', 1);

    assert.equal(plain(offer.listPrice), '$333.48');
    assert.equal(plain(offerInUsd.listPrice), 'USD 18.53');
    assert.equal(plain(buildProductDetailModel({ ...base, listPrice: 277.9 }, 'es', 'MXN', 1).listPrice), undefined);
    assert.equal(plain(buildProductDetailModel({ ...base, listPrice: 100 }, 'es', 'MXN', 1).listPrice), undefined);
    assert.equal(plain(buildProductDetailModel(base, 'es', 'MXN', 1).listPrice), undefined);
  });

  it('changing the preferred currency changes the view and never the product', () => {
    const before = JSON.stringify(base);
    buildProductDetailModel(base, 'es', 'USD', 3);

    assert.equal(JSON.stringify(base), before);
  });
});

describe('buildProductDetailModel: the total follows the quantity (RF-6)', () => {
  it('multiplies the canonical value, then converts and formats', () => {
    assert.equal(plain(buildProductDetailModel(base, 'es', 'MXN', 1).total), '$277.90');
    assert.equal(plain(buildProductDetailModel(base, 'es', 'MXN', 3).total), '$833.70');
    assert.equal(plain(buildProductDetailModel(usdProduct, 'es', 'MXN', 99).total), '$21,366.18');
    assert.equal(plain(buildProductDetailModel(usdProduct, 'es', 'USD', 99).total), 'USD 1,187.01');
  });

  it('converts the whole line at once, so it matches the cart and not quantity times the rounded unit', () => {
    // 149.90 MXN is 8.3277 USD: the unit is shown as USD 8.33. Five units are 749.50 MXN = USD 41.64,
    // while 5 x 8.33 would say 41.65. The line is converted from the canonical value, as the cart does.
    const cheap: ProductDetail = { ...base, price: 149.9 };

    assert.equal(plain(buildProductDetailModel(cheap, 'es', 'USD', 1).price), 'USD 8.33');
    assert.equal(plain(buildProductDetailModel(cheap, 'es', 'USD', 5).total), 'USD 41.64');
    assert.equal(plain(buildProductDetailModel(cheap, 'es', 'MXN', 5).total), '$749.50');
  });

  it('shows a zero total when nothing is selected', () => {
    assert.equal(plain(buildProductDetailModel(base, 'es', 'MXN', 0).total), '$0.00');
  });
});

describe('buildProductDetailModel: availability from the real stock (RF-4)', () => {
  it('is in stock with the number of units available', () => {
    assert.deepEqual(buildProductDetailModel(base, 'es', 'MXN', 1).availability, {
      kind: 'in_stock',
      stock: 99,
      stockText: '99',
    });
    assert.deepEqual(buildProductDetailModel({ ...base, stock: 1 }, 'es', 'MXN', 1).availability, {
      kind: 'in_stock',
      stock: 1,
      stockText: '1',
    });
  });

  it('is out of stock with zero units, whatever `inStock` says: the number decides', () => {
    const soldOut = { ...base, stock: 0 };

    assert.deepEqual(buildProductDetailModel({ ...soldOut, inStock: false }, 'es', 'MXN', 0).availability, {
      kind: 'out_of_stock',
    });
    assert.deepEqual(buildProductDetailModel({ ...soldOut, inStock: true }, 'es', 'MXN', 0).availability, {
      kind: 'out_of_stock',
    });
  });

  it('formats a large stock for the interface language', () => {
    const model = buildProductDetailModel({ ...base, stock: 1500 }, 'en', 'MXN', 1);

    assert.deepEqual(model.availability, { kind: 'in_stock', stock: 1500, stockText: '1,500' });
  });
});
