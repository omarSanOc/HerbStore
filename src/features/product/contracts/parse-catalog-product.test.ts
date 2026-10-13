/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseBrandOptions,
  parseCatalogProduct,
  parseCategoryTree,
  parseProductPage,
} from './parse-catalog-product.ts';

type Mutable = Record<string, any>;

/** A product shaped like the real `GET /products` item (extra wire fields included on purpose). */
function wireProduct(index: number, extra: Mutable = {}): Mutable {
  const n = String(index).padStart(3, '0');
  return {
    id: `product-261009-${n}`,
    ean13: `200261009${String(index).padStart(4, '0')}`,
    brand: 'AsterVale Nutrition',
    name: 'Complete Daily Powder',
    categoryId: 'vitamins',
    subcategoryId: 'multivitamins',
    price: 12.99,
    currency: 'USD',
    rating: 3.1,
    reviewCount: 815,
    soldLast30Days: 504,
    badges: ['NEW'],
    inStock: true,
    isOwnBrand: false,
    subscribeAndSave: false,
    images: [`/images/products/product-${n}-front.png`, `/images/products/product-${n}-detail.png`],
    servingInfo: { size: '1 scoop (20 g)', servingsPerContainer: 29 },
    description: 'A fictional product.',
    ...extra,
  };
}

function wirePage(): Mutable {
  return { items: [wireProduct(1), wireProduct(2)], page: 1, totalPages: 3, total: 41 };
}

function brokenPage(change: (page: Mutable) => void): unknown {
  const page = wirePage();
  change(page);
  return page;
}

describe('parseCatalogProduct', () => {
  it('projects the wire product onto the fields the app trusts', () => {
    assert.deepEqual(parseCatalogProduct(wireProduct(7)), {
      id: 'product-261009-007',
      brand: 'AsterVale Nutrition',
      name: 'Complete Daily Powder',
      categoryId: 'vitamins',
      subcategoryId: 'multivitamins',
      price: 12.99,
      currency: 'USD',
      rating: 3.1,
      reviewCount: 815,
      soldLast30Days: 504,
      badges: ['NEW'],
      inStock: true,
      images: ['/images/products/product-007-front.png', '/images/products/product-007-detail.png'],
    });
  });

  it('keeps the optional fields only when present', () => {
    const parsed = parseCatalogProduct(wireProduct(1, { listPrice: 15.59, couponText: 'Save 10%' }));

    assert.equal(parsed?.listPrice, 15.59);
    assert.equal(parsed?.couponText, 'Save 10%');
    assert.equal('listPrice' in (parseCatalogProduct(wireProduct(1)) ?? {}), false);
  });

  it('returns undefined for anything that is not a well formed product', () => {
    assert.equal(parseCatalogProduct(undefined), undefined);
    assert.equal(parseCatalogProduct(null), undefined);
    assert.equal(parseCatalogProduct([]), undefined);
    assert.equal(parseCatalogProduct(wireProduct(1, { price: '12.99' })), undefined);
    assert.equal(parseCatalogProduct(wireProduct(1, { rating: 5.5 })), undefined);
  });
});

describe('parseProductPage: valid pages', () => {
  it('parses the real wire shape { items, page, totalPages, total }', () => {
    const page = parseProductPage(wirePage());

    assert.ok(page);
    assert.equal(page.page, 1);
    assert.equal(page.totalPages, 3);
    assert.equal(page.total, 41);
    assert.deepEqual(
      page.items.map(({ id }) => id),
      ['product-261009-001', 'product-261009-002'],
    );
  });

  it('accepts the empty result the server gives for a query without matches', () => {
    assert.deepEqual(parseProductPage({ items: [], page: 1, totalPages: 0, total: 0 }), {
      items: [],
      page: 1,
      totalPages: 0,
      total: 0,
    });
  });

  it('accepts a page beyond the last one (the server answers it with no items)', () => {
    const page = parseProductPage({ items: [], page: 9, totalPages: 3, total: 41 });

    assert.equal(page?.items.length, 0);
    assert.equal(page?.page, 9);
  });

  it('does not alias the input', () => {
    const wire = wirePage();
    const page = parseProductPage(wire);
    wire.items[0].images.push('/x.png');
    wire.items[0].name = 'changed';

    assert.equal(page?.items[0]?.images.length, 2);
    assert.equal(page?.items[0]?.name, 'Complete Daily Powder');
  });
});

describe('parseProductPage: invalid pages', () => {
  const cases: [string, unknown][] = [
    ['undefined', undefined],
    ['null', null],
    ['an array', []],
    ['an error envelope', { error: { code: 'INVALID_QUERY', message: 'x' } }],
    ['items missing', brokenPage((p) => delete p.items)],
    ['items not an array', brokenPage((p) => (p.items = {}))],
    ['a malformed element', brokenPage((p) => (p.items[1].price = 'free'))],
    ['a null element', brokenPage((p) => (p.items[0] = null))],
    ['a repeated id', brokenPage((p) => (p.items[1].id = p.items[0].id))],
    ['page 0', brokenPage((p) => (p.page = 0))],
    ['negative page', brokenPage((p) => (p.page = -1))],
    ['fractional page', brokenPage((p) => (p.page = 1.5))],
    ['page as a string', brokenPage((p) => (p.page = '1'))],
    ['page missing', brokenPage((p) => delete p.page)],
    ['negative totalPages', brokenPage((p) => (p.totalPages = -1))],
    ['fractional totalPages', brokenPage((p) => (p.totalPages = 2.5))],
    ['totalPages as null', brokenPage((p) => (p.totalPages = null))],
    ['negative total', brokenPage((p) => (p.total = -5))],
    ['fractional total', brokenPage((p) => (p.total = 0.5))],
    ['NaN total', brokenPage((p) => (p.total = Number.NaN))],
    ['total missing', brokenPage((p) => delete p.total)],
  ];

  for (const [label, payload] of cases) {
    it(`returns undefined for ${label}`, () => {
      assert.equal(parseProductPage(payload), undefined);
    });
  }
});

describe('parseBrandOptions', () => {
  const wire = () => [
    { name: 'AsterVale Nutrition', productCount: 40 },
    { name: 'HerbStore Essentials', productCount: 38 },
  ];

  it('parses the wire shape [{ name, productCount }]', () => {
    assert.deepEqual(parseBrandOptions(wire()), wire());
  });

  it('accepts an empty list', () => {
    assert.deepEqual(parseBrandOptions([]), []);
  });

  it('tells valid and invalid facets apart', () => {
    const invalid: unknown[] = [
      undefined,
      {},
      [{ name: '', productCount: 1 }],
      [{ productCount: 1 }],
      [{ name: 'A', productCount: -1 }],
      [{ name: 'A', productCount: 1.5 }],
      [{ name: 'A', productCount: '3' }],
      [null],
      [{ name: 'A', productCount: 1 }, { name: 'A', productCount: 2 }],
    ];

    for (const payload of invalid) {
      assert.equal(parseBrandOptions(payload), undefined, JSON.stringify(payload));
    }
  });

  it('ignores extra fields without keeping them', () => {
    assert.deepEqual(parseBrandOptions([{ name: 'A', productCount: 1, extra: true }]), [
      { name: 'A', productCount: 1 },
    ]);
  });
});

describe('parseCategoryTree', () => {
  const wire = (): Mutable[] => [
    {
      id: 'vitamins',
      name: 'Vitamins',
      productCount: 60,
      subcategories: [
        { id: 'multivitamins', name: 'Multivitamins', productCount: 20 },
        { id: 'vitamin-c', name: 'Vitamin C', productCount: 40 },
      ],
    },
    { id: 'minerals', name: 'Minerals', productCount: 0, subcategories: [] },
  ];

  it('parses the wire shape with subcategories', () => {
    assert.deepEqual(parseCategoryTree(wire()), wire());
  });

  it('accepts an empty tree', () => {
    assert.deepEqual(parseCategoryTree([]), []);
  });

  it('tells valid and invalid trees apart', () => {
    const cases: [string, (tree: Mutable[]) => void][] = [
      ['category without id', (t) => delete t[0].id],
      ['category with empty name', (t) => (t[0].name = '')],
      ['negative productCount', (t) => (t[0].productCount = -1)],
      ['subcategories missing', (t) => delete t[0].subcategories],
      ['subcategories not an array', (t) => (t[0].subcategories = {})],
      ['subcategory without id', (t) => delete t[0].subcategories[0].id],
      ['subcategory with bad count', (t) => (t[0].subcategories[0].productCount = 'x')],
      ['null subcategory', (t) => (t[0].subcategories[1] = null)],
      ['repeated category id', (t) => (t[1].id = t[0].id)],
      ['repeated subcategory id in a category', (t) => (t[0].subcategories[1].id = 'multivitamins')],
      [
        'subcategory id repeated across categories',
        (t) => t[1].subcategories.push({ id: 'vitamin-c', name: 'Dup', productCount: 1 }),
      ],
    ];

    for (const [label, change] of cases) {
      const tree = wire();
      change(tree);
      assert.equal(parseCategoryTree(tree), undefined, label);
    }
    assert.equal(parseCategoryTree({}), undefined);
    assert.equal(parseCategoryTree(null), undefined);
  });
});

// Contract check against the real server code. It needs the mock server's own dependencies
// (`npm --prefix mock-server install`) and is skipped without them.
const serverModules = await (async () => {
  try {
    const catalogPath = '../../../../mock-server/src/catalog/generate-catalog.js';
    const queryPath = '../../../../mock-server/src/catalog/query-products.js';
    const homePath = '../../../../mock-server/src/catalog/home-data.js';
    const catalog = (await import(catalogPath)) as { generateCatalog: () => unknown[] };
    const query = (await import(queryPath)) as {
      queryProducts: (products: unknown[], raw: Record<string, string>) => unknown;
    };
    const home = (await import(homePath)) as {
      createBrandData: (products: unknown[]) => unknown;
      createCategoryTree: (products: unknown[]) => unknown;
    };
    return { ...catalog, ...query, ...home };
  } catch {
    return undefined;
  }
})();

describe('catalog parsers against the real mock server data', () => {
  const skip = serverModules === undefined ? 'mock-server dependencies are not installed' : false;
  const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  it('accepts every page of the whole catalog, with the real totals', { skip }, () => {
    assert.ok(serverModules);
    const products = serverModules.generateCatalog();
    const first = parseProductPage(
      json(serverModules.queryProducts(products, { page: '1', limit: '20' })),
    );

    assert.ok(first);
    assert.equal(first.total, 300);
    assert.equal(first.totalPages, 15);
    assert.equal(first.items.length, 20);

    const seen = new Set<string>();
    for (let page = 1; page <= first.totalPages; page += 1) {
      const parsed = parseProductPage(
        json(serverModules.queryProducts(products, { page: String(page), limit: '20' })),
      );
      assert.ok(parsed, `page ${page}`);
      parsed.items.forEach(({ id }) => seen.add(id));
    }
    assert.equal(seen.size, 300);
  });

  it('accepts an empty filtered page and a page beyond the last', { skip }, () => {
    assert.ok(serverModules);
    const products = serverModules.generateCatalog();

    const none = parseProductPage(
      json(serverModules.queryProducts(products, { q: 'zzzz-no-match' })),
    );
    assert.deepEqual(none && [none.items.length, none.totalPages, none.total], [0, 0, 0]);

    const beyond = parseProductPage(json(serverModules.queryProducts(products, { page: '99' })));
    assert.deepEqual(beyond && [beyond.items.length, beyond.totalPages], [0, 15]);
  });

  it('accepts the real brands and category tree', { skip }, () => {
    assert.ok(serverModules);
    const products = serverModules.generateCatalog();

    const brands = parseBrandOptions(json(serverModules.createBrandData(products)));
    assert.ok(brands);
    assert.equal(brands.length, 8);
    assert.equal(
      brands.reduce((sum, { productCount }) => sum + productCount, 0),
      300,
    );

    const tree = parseCategoryTree(json(serverModules.createCategoryTree(products)));
    assert.ok(tree);
    assert.equal(tree.length, 5);
    assert.equal(tree.flatMap(({ subcategories }) => subcategories).length, 15);
  });
});
