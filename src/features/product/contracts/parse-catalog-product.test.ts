/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseBrandOptions,
  parseCatalogProduct,
  parseCategoryTree,
  parseProductDetail,
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

/** A product shaped like the real `GET /products/:id` answer: the catalog entry plus `stock`. */
function wireDetail(index: number, extra: Mutable = {}): Mutable {
  return wireProduct(index, { stock: 99, ...extra });
}

describe('parseProductDetail: valid details', () => {
  it('extends the catalog product with description, serving info and stock', () => {
    assert.deepEqual(parseProductDetail(wireDetail(7)), {
      ...parseCatalogProduct(wireProduct(7)),
      description: 'A fictional product.',
      servingInfo: { size: '1 scoop (20 g)', servingsPerContainer: 29 },
      stock: 99,
    });
  });

  it('accepts a sold out product: stock 0 together with inStock false', () => {
    const parsed = parseProductDetail(wireDetail(1, { stock: 0, inStock: false }));

    assert.equal(parsed?.stock, 0);
    assert.equal(parsed?.inStock, false);
  });

  it('accepts stock 1 and a large stock', () => {
    assert.equal(parseProductDetail(wireDetail(1, { stock: 1 }))?.stock, 1);
    assert.equal(parseProductDetail(wireDetail(1, { stock: 10_000 }))?.stock, 10_000);
  });

  it('does not keep the wire fields the app does not trust, and does not alias the input', () => {
    const wire = wireDetail(3);
    const parsed = parseProductDetail(wire);

    assert.ok(parsed);
    assert.equal('ean13' in parsed, false);
    assert.equal('isOwnBrand' in parsed, false);
    assert.notEqual(parsed.servingInfo, wire.servingInfo);
    wire.servingInfo.size = 'changed';
    assert.equal(parsed.servingInfo.size, '1 scoop (20 g)');
  });
});

describe('parseProductDetail: invalid details', () => {
  const cases: [string, (detail: Mutable) => void][] = [
    ['no stock', (detail) => delete detail.stock],
    ['a fractional stock', (detail) => (detail.stock = 2.5)],
    ['a negative stock', (detail) => (detail.stock = -1)],
    ['a stock that is text', (detail) => (detail.stock = '5')],
    ['a stock that is not finite', (detail) => (detail.stock = Infinity)],
    ['a stock beyond the safe integers', (detail) => (detail.stock = 2 ** 60)],
    ['stock 0 but inStock true', (detail) => ((detail.stock = 0), (detail.inStock = true))],
    ['stock above 0 but inStock false', (detail) => ((detail.stock = 4), (detail.inStock = false))],
    ['no description', (detail) => delete detail.description],
    ['an empty description', (detail) => (detail.description = '')],
    ['a description that is not text', (detail) => (detail.description = 5)],
    ['no serving info', (detail) => delete detail.servingInfo],
    ['serving info that is not an object', (detail) => (detail.servingInfo = '2 capsules')],
    ['a serving size that is empty', (detail) => (detail.servingInfo.size = '')],
    ['a serving size that is not text', (detail) => (detail.servingInfo.size = 2)],
    ['no servings per container', (detail) => delete detail.servingInfo.servingsPerContainer],
    ['zero servings per container', (detail) => (detail.servingInfo.servingsPerContainer = 0)],
    ['fractional servings per container', (detail) => (detail.servingInfo.servingsPerContainer = 2.5)],
    ['a catalog field that is malformed', (detail) => (detail.price = -3)],
    ['a missing id', (detail) => delete detail.id],
  ];

  for (const [name, change] of cases) {
    it(`is rejected with ${name}`, () => {
      const detail = wireDetail(1);
      change(detail);

      assert.equal(parseProductDetail(detail), undefined);
    });
  }

  it('is rejected for anything that is not an object', () => {
    for (const value of [undefined, null, [], 'product', 5]) {
      assert.equal(parseProductDetail(value), undefined);
    }
  });

  it('a list item (no stock) is not a detail', () => {
    assert.equal(parseProductDetail(wireProduct(1)), undefined);
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

// The parsers must accept everything shaped like the API contract (RF-10, RF-13, RF-14), with our
// own immutable data: a small catalog table and the pages, details, brands and category tree built
// from it. What the real API serves (totals, filters, sorts) is checked by the opt-in live smoke,
// not by the unit suite (RF-41).
describe('catalog parsers against a controlled catalog table', () => {
  const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

  /** Six products across three brands and two categories; one sold out, one in MXN. */
  const table: Mutable[] = [
    wireProduct(1),
    wireProduct(2, { brand: 'Solstice Grove', categoryId: 'minerals', subcategoryId: 'zinc', price: 9.5, rating: 4.6, isOwnBrand: true }),
    wireProduct(3, { brand: 'Fernlight Labs', subcategoryId: 'vitamin-d', rating: 3.8, subscribeAndSave: true }),
    wireProduct(4, { brand: 'Solstice Grove', subcategoryId: 'zinc', price: 21, listPrice: 24.99, inStock: false }),
    wireProduct(5, { brand: 'Fernlight Labs', categoryId: 'minerals', subcategoryId: 'magnesium', rating: 4.9 }),
    wireProduct(6, { brand: 'Solstice Grove', categoryId: 'minerals', subcategoryId: 'magnesium', currency: 'MXN', price: 299 }),
  ];

  /** Paging as RF-10 defines it: one-based page, totals computed before answering. */
  const pageOf = (page: number, limit = 2): Mutable => ({
    items: table.slice((page - 1) * limit, page * limit),
    page,
    totalPages: Math.ceil(table.length / limit),
    total: table.length,
  });

  it('accepts every page of the catalog, with totals and no repeated id', () => {
    const first = parseProductPage(json(pageOf(1)));

    assert.ok(first);
    assert.equal(first.total, 6);
    assert.equal(first.totalPages, 3);
    assert.equal(first.items.length, 2);

    const seen = new Set<string>();
    for (let page = 1; page <= first.totalPages; page += 1) {
      const parsed = parseProductPage(json(pageOf(page)));
      assert.ok(parsed, `page ${page}`);
      parsed.items.forEach(({ id }) => seen.add(id));
    }
    assert.equal(seen.size, 6);
  });

  it('accepts the detail of every product, with inStock equal to stock > 0', () => {
    for (const product of table) {
      // RF-14: the detail answers the catalog product plus `stock`, and `inStock` mirrors `stock`.
      const stock = product.inStock ? 99 : 0;
      const detail = parseProductDetail(json({ ...product, stock }));

      assert.ok(detail, String(product.id));
      assert.equal(detail.stock, stock);
      assert.equal(detail.inStock, stock > 0);
      assert.ok(detail.description.length > 0);
    }
  });

  it('accepts an empty filtered page and a page beyond the last', () => {
    const none = parseProductPage(json({ items: [], page: 1, totalPages: 0, total: 0 }));
    assert.deepEqual(none && [none.items.length, none.totalPages, none.total], [0, 0, 0]);

    const beyond = parseProductPage(json(pageOf(99)));
    assert.deepEqual(beyond && [beyond.items.length, beyond.totalPages], [0, 3]);
  });

  it('accepts brands aggregated from the table and a category tree', () => {
    const counts = new Map<string, number>();
    for (const { brand } of table) counts.set(brand, (counts.get(brand) ?? 0) + 1);
    const brands = parseBrandOptions(
      json([...counts].map(([name, productCount]) => ({ name, productCount }))),
    );

    assert.ok(brands);
    assert.equal(brands.length, 3);
    assert.equal(brands.reduce((sum, { productCount }) => sum + productCount, 0), 6);

    const tree = parseCategoryTree(
      json(
        Array.from({ length: 5 }, (_, c) => ({
          id: `category-${c}`,
          name: `Category ${c}`,
          productCount: 3,
          subcategories: Array.from({ length: 3 }, (_, s) => ({
            id: `category-${c}-sub-${s}`,
            name: `Subcategory ${s}`,
            productCount: 1,
          })),
        })),
      ),
    );

    assert.ok(tree);
    assert.equal(tree.length, 5);
    assert.equal(tree.flatMap(({ subcategories }) => subcategories).length, 15);
  });
});
