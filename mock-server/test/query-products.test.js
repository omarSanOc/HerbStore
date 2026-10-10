import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATALOG_SEED,
  generateCatalog,
} from '../src/catalog/generate-catalog.js';
import {
  ProductQueryError,
  queryProducts,
} from '../src/catalog/query-products.js';

const catalog = generateCatalog(CATALOG_SEED);

function ids(page) {
  return page.items.map((product) => product.id);
}

describe('product query rules', () => {
  it('uses the approved pagination defaults and preserves metadata after the last page', () => {
    const firstPage = queryProducts(catalog, {});
    const laterPage = queryProducts(catalog, { page: '16' });

    assert.deepEqual(
      {
        itemCount: firstPage.items.length,
        page: firstPage.page,
        totalPages: firstPage.totalPages,
        total: firstPage.total,
      },
      { itemCount: 20, page: 1, totalPages: 15, total: 300 },
    );
    assert.deepEqual(laterPage, {
      items: [],
      page: 16,
      totalPages: 15,
      total: 300,
    });
  });

  it('applies OR inside CSV facets and AND between different facets', () => {
    const [firstBrand, secondBrand] = [...new Set(catalog.map(({ brand }) => brand))];
    const subcategory = catalog.find(
      (product) => product.brand === firstBrand || product.brand === secondBrand,
    ).subcategoryId;
    const expected = catalog.filter(
      (product) =>
        (product.brand === firstBrand || product.brand === secondBrand) &&
        product.subcategoryId === subcategory,
    );

    const result = queryProducts(catalog, {
      brand: `${firstBrand},Unknown Fictional Brand,${secondBrand}`,
      subcategory,
      limit: '50',
    });

    assert.equal(result.total, expected.length);
    assert.deepEqual(ids(result), expected.slice(0, 50).map(({ id }) => id));
  });

  it('combines category, rating, stock, own-brand, and subscription filters before pagination', () => {
    const expected = catalog.filter(
      (product) =>
        product.categoryId === 'vitamins' &&
        product.rating >= 4 &&
        product.inStock &&
        product.isOwnBrand &&
        product.subscribeAndSave,
    );

    const result = queryProducts(catalog, {
      category: 'vitamins',
      minRating: '4',
      inStock: 'true',
      ownBrand: 'true',
      subscribeAndSave: 'true',
      limit: '50',
    });

    assert.equal(result.total, expected.length);
    assert.deepEqual(ids(result), expected.map(({ id }) => id));
  });

  it('searches brand, name, and description with normalized case and whitespace', () => {
    const brandResult = queryProducts(catalog, { q: '  HERBSTORE   ESSENTIALS ' });
    const product = catalog[0];
    const nameResult = queryProducts(catalog, { q: product.name.toUpperCase() });
    const descriptionResult = queryProducts(catalog, {
      q: '  SIMPLE   DAILY WELLNESS ',
    });

    assert.ok(brandResult.total > 0);
    assert.ok(
      brandResult.items.every(({ brand }) => brand === 'HerbStore Essentials'),
    );
    assert.ok(ids(nameResult).includes(product.id));
    assert.equal(descriptionResult.total, 300);
  });

  it('returns an empty successful page for syntactically valid unknown facets', () => {
    for (const query of [
      { category: 'unknown-category' },
      { brand: 'Unknown Fictional Brand' },
      { subcategory: 'unknown-subcategory' },
    ]) {
      assert.deepEqual(queryProducts(catalog, query), {
        items: [],
        page: 1,
        totalPages: 0,
        total: 0,
      });
    }
  });

  it('supports every approved deterministic sort', () => {
    const byPriceAscending = queryProducts(catalog, {
      sort: 'price_asc',
      limit: '50',
    }).items;
    const byPriceDescending = queryProducts(catalog, {
      sort: 'price_desc',
      limit: '50',
    }).items;
    const byRating = queryProducts(catalog, {
      sort: 'rating',
      limit: '50',
    }).items;
    const bySales = queryProducts(catalog, {
      sort: 'best_selling',
      limit: '50',
    }).items;
    const featured = queryProducts(catalog, {
      sort: 'featured',
      limit: '50',
    }).items;

    assert.ok(
      byPriceAscending.every(
        (product, index) => index === 0 || byPriceAscending[index - 1].price <= product.price,
      ),
    );
    assert.ok(
      byPriceDescending.every(
        (product, index) => index === 0 || byPriceDescending[index - 1].price >= product.price,
      ),
    );
    assert.ok(
      byRating.every(
        (product, index) => index === 0 || byRating[index - 1].rating >= product.rating,
      ),
    );
    assert.ok(
      bySales.every(
        (product, index) =>
          index === 0 ||
          bySales[index - 1].soldLast30Days >= product.soldLast30Days,
      ),
    );
    assert.deepEqual(ids({ items: featured }), catalog.slice(0, 50).map(({ id }) => id));
  });

  it('rejects malformed filters, sorts, booleans, and pagination consistently', () => {
    const invalidQueries = [
      { category: '' },
      { category: '   ' },
      { brand: 'AsterVale Nutrition,' },
      { brand: ',AsterVale Nutrition' },
      { subcategory: 'magnesium,,zinc' },
      { q: '   ' },
      { minRating: '' },
      { minRating: '-1' },
      { minRating: '5.1' },
      { minRating: 'four' },
      { inStock: '1' },
      { ownBrand: 'TRUE' },
      { subscribeAndSave: 'yes' },
      { fail: '0' },
      { sort: 'popular' },
      { page: '0' },
      { page: '1.5' },
      { limit: '0' },
      { limit: '51' },
      { limit: '2.5' },
      { brand: ['AsterVale Nutrition', 'CedarKind Labs'] },
    ];

    for (const query of invalidQueries) {
      assert.throws(
        () => queryProducts(catalog, query),
        (error) =>
          error instanceof ProductQueryError && error.code === 'INVALID_QUERY',
        JSON.stringify(query),
      );
    }
  });
});
