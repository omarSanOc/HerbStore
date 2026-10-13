/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CatalogProduct, ProductPage } from '../contracts/catalog-product.ts';
import { PRODUCT_LIST_TAG, productListTags, productTag } from './product-tags.ts';

function product(id: string): CatalogProduct {
  return {
    id,
    brand: 'AsterVale Nutrition',
    name: `Product ${id}`,
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 12.99,
    currency: 'USD',
    rating: 4.2,
    reviewCount: 10,
    soldLast30Days: 5,
    badges: [],
    inStock: true,
    images: [],
  };
}

const pageOf = (ids: readonly string[], page: number): ProductPage => ({
  items: ids.map(product),
  page,
  totalPages: 2,
  total: 4,
});

describe('product tags', () => {
  it('names the list tag with the shared LIST id', () => {
    assert.deepEqual(PRODUCT_LIST_TAG, { type: 'ProductList', id: 'LIST' });
  });

  it('names a product tag by its id', () => {
    assert.deepEqual(productTag('a'), { type: 'Product', id: 'a' });
  });

  it('provides the list tag plus one tag per product of every loaded page', () => {
    assert.deepEqual(productListTags([pageOf(['a', 'b'], 1), pageOf(['c'], 2)]), [
      { type: 'ProductList', id: 'LIST' },
      { type: 'Product', id: 'a' },
      { type: 'Product', id: 'b' },
      { type: 'Product', id: 'c' },
    ]);
  });

  it('does not repeat a product that appears in two pages', () => {
    assert.deepEqual(productListTags([pageOf(['a', 'b'], 1), pageOf(['b', 'c'], 2)]), [
      { type: 'ProductList', id: 'LIST' },
      { type: 'Product', id: 'a' },
      { type: 'Product', id: 'b' },
      { type: 'Product', id: 'c' },
    ]);
  });

  it('keeps only the list tag when there are no pages (a failed first load or no matches)', () => {
    assert.deepEqual(productListTags(undefined), [{ type: 'ProductList', id: 'LIST' }]);
    assert.deepEqual(productListTags([]), [{ type: 'ProductList', id: 'LIST' }]);
    assert.deepEqual(productListTags([pageOf([], 1)]), [{ type: 'ProductList', id: 'LIST' }]);
  });
});
