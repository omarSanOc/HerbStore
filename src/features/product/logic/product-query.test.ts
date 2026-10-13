/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildProductQueryArgs,
  describeQueryForLog,
  normalizeSearchText,
  PRODUCT_LIST_LIMIT,
  PRODUCT_SORTS,
  toProductQueryString,
  type ProductQueryArgs,
} from './product-query.ts';

describe('normalizeSearchText', () => {
  it('trims, collapses spaces, lowercases and removes diacritics', () => {
    assert.equal(normalizeSearchText('  Vitamina   Ç '), 'vitamina c');
  });

  it('turns a string of only spaces into the empty string', () => {
    assert.equal(normalizeSearchText('     '), '');
    assert.equal(normalizeSearchText(''), '');
    assert.equal(normalizeSearchText('\t \n'), '');
  });

  it('removes accents in precomposed and decomposed form alike', () => {
    assert.equal(normalizeSearchText('Magnésio ÑANDÚ'), 'magnesio nandu');
    assert.equal(normalizeSearchText('Magnésio'), 'magnesio');
    assert.equal(normalizeSearchText('Magésio'), normalizeSearchText('Magésio'));
  });

  it('is idempotent', () => {
    const once = normalizeSearchText('  ÁCIDO   Fólico ');
    assert.equal(normalizeSearchText(once), once);
  });

  it('matches what the mock server does to the same text', async () => {
    let serverNormalize: ((text: string) => string) | undefined;
    try {
      const path = '../../../../mock-server/src/catalog/normalize-text.js';
      serverNormalize = ((await import(path)) as { normalizeText: (text: string) => string })
        .normalizeText;
    } catch {
      return;
    }
    for (const sample of ['  Vitamina   Ç ', 'ÁCIDO Fólico', 'Omega-3  ', 'ñandú\t', 'AsterVale']) {
      assert.equal(normalizeSearchText(sample), serverNormalize(sample), sample);
    }
  });
});

describe('buildProductQueryArgs: canonical identity', () => {
  it('gives deeply equal args for equivalent inputs (case, diacritics, spaces and order)', () => {
    const a = buildProductQueryArgs({
      category: 'vitamins',
      search: '  Vitamina   Ç ',
      brands: ['Solstice Grove', 'AsterVale Nutrition'],
      subcategories: ['vitamin-d', 'Vitamin-C'],
      inStock: true,
      sort: 'price_asc',
    });
    const b = buildProductQueryArgs({
      category: 'VITAMINS',
      search: 'vitamina c',
      brands: ['astervale  nutrition', 'SOLSTICE GROVE', 'asterVALE nutrition'],
      subcategories: ['vitamin-c', 'VITAMIN-D', 'vitamin-d'],
      inStock: true,
      sort: 'price_asc',
    });

    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'same key order too, not only same content');
  });

  it('sorts and deduplicates the facets', () => {
    const args = buildProductQueryArgs({
      brands: ['b', 'A', 'b', ' a '],
      subcategories: ['z', 'y', 'z'],
    });

    assert.deepEqual(args.brand, ['a', 'b']);
    assert.deepEqual(args.subcategory, ['y', 'z']);
  });

  it('omits every inactive or empty key', () => {
    const args = buildProductQueryArgs({
      search: '   ',
      category: '  ',
      brands: [],
      subcategories: ['  '],
      inStock: false,
      topRated: false,
      ownBrand: false,
      subscribeAndSave: false,
    });

    assert.deepEqual(args, { sort: 'featured', limit: PRODUCT_LIST_LIMIT });
    for (const key of ['q', 'category', 'brand', 'subcategory', 'inStock', 'minRating', 'ownBrand', 'subscribeAndSave']) {
      assert.equal(key in args, false, key);
    }
  });

  it('maps each active quick filter to its wire value', () => {
    const args = buildProductQueryArgs({
      inStock: true,
      topRated: true,
      ownBrand: true,
      subscribeAndSave: true,
    });

    assert.equal(args.inStock, true);
    assert.equal(args.minRating, 4);
    assert.equal(args.ownBrand, true);
    assert.equal(args.subscribeAndSave, true);
  });

  it('defaults to featured and always has limit 20 and no page', () => {
    const args = buildProductQueryArgs({});

    assert.equal(args.sort, 'featured');
    assert.equal(args.limit, 20);
    assert.equal('page' in args, false);
  });

  it('keeps the exact sort values', () => {
    assert.deepEqual(PRODUCT_SORTS, ['featured', 'price_asc', 'price_desc', 'rating', 'best_selling']);
    for (const sort of PRODUCT_SORTS) {
      assert.equal(buildProductQueryArgs({ sort }).sort, sort);
    }
  });

  it('different filters are different identities', () => {
    const base = buildProductQueryArgs({ search: 'zinc' });

    assert.notDeepEqual(base, buildProductQueryArgs({ search: 'zinc', inStock: true }));
    assert.notDeepEqual(base, buildProductQueryArgs({ search: 'zinc', sort: 'rating' }));
    assert.notDeepEqual(base, buildProductQueryArgs({ search: 'zinc', brands: ['a'] }));
    assert.notDeepEqual(base, buildProductQueryArgs({ search: 'magnesium' }));
  });

  it('does not mutate its input or share arrays with it', () => {
    const brands = ['b', 'a'];
    const input = Object.freeze({ brands: Object.freeze(brands) });
    const args = buildProductQueryArgs(input);

    assert.deepEqual(brands, ['b', 'a']);
    assert.notEqual(args.brand, brands);
  });
});

describe('toProductQueryString', () => {
  it('serializes every parameter, facets as CSV with each value encoded', () => {
    const args = buildProductQueryArgs({
      category: 'vitamins',
      search: 'Vitamina Ç',
      brands: ['Solstice Grove', 'AsterVale Nutrition'],
      subcategories: ['vitamin-c', 'multivitamins'],
      inStock: true,
      topRated: true,
      ownBrand: true,
      subscribeAndSave: true,
      sort: 'best_selling',
    });

    assert.equal(
      toProductQueryString(args, 2),
      'category=vitamins&q=vitamina%20c&brand=astervale%20nutrition,solstice%20grove' +
        '&subcategory=multivitamins,vitamin-c&inStock=true&minRating=4&ownBrand=true' +
        '&subscribeAndSave=true&sort=best_selling&page=2&limit=20',
    );
  });

  it('serializes the default query with only sort, page and limit', () => {
    assert.equal(
      toProductQueryString(buildProductQueryArgs({}), 1),
      'sort=featured&page=1&limit=20',
    );
  });

  it('encodes reserved characters in every value but keeps the CSV separator', () => {
    const args: ProductQueryArgs = {
      q: 'a&b=c#d',
      brand: ['x y', 'p/q'],
      sort: 'featured',
      limit: 20,
    };

    assert.equal(
      toProductQueryString(args, 1),
      'q=a%26b%3Dc%23d&brand=x%20y,p%2Fq&sort=featured&page=1&limit=20',
    );
  });

  it('uses a single subcategory without a separator', () => {
    assert.equal(
      toProductQueryString(buildProductQueryArgs({ subcategories: ['zinc'] }), 1),
      'subcategory=zinc&sort=featured&page=1&limit=20',
    );
  });

  it('sends each quick filter exactly', () => {
    const only = (input: Parameters<typeof buildProductQueryArgs>[0]) =>
      toProductQueryString(buildProductQueryArgs(input), 1);

    assert.match(only({ inStock: true }), /(^|&)inStock=true(&|$)/);
    assert.match(only({ topRated: true }), /(^|&)minRating=4(&|$)/);
    assert.match(only({ ownBrand: true }), /(^|&)ownBrand=true(&|$)/);
    assert.match(only({ subscribeAndSave: true }), /(^|&)subscribeAndSave=true(&|$)/);
  });

  it('rejects a page that is not a positive integer', () => {
    const args = buildProductQueryArgs({});

    for (const page of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => toProductQueryString(args, page), RangeError, String(page));
    }
  });

  it('the page changes the URL but never the identity', () => {
    const args = buildProductQueryArgs({ search: 'zinc' });

    assert.notEqual(toProductQueryString(args, 1), toProductQueryString(args, 2));
    assert.equal(JSON.stringify(args).includes('page'), false);
  });
});

// The server is the source of truth for what the parameters mean: feed the generated query
// string to its own parser and filter.
describe('toProductQueryString against the real mock server query', () => {
  it('is accepted and honoured by the server', async () => {
    type Server = {
      queryProducts: (products: unknown[], raw: Record<string, string>) => {
        items: { brand: string; subcategoryId: string; inStock: boolean; rating: number }[];
        page: number;
        total: number;
      };
    };
    let products: unknown[];
    let server: Server;
    try {
      const catalogPath = '../../../../mock-server/src/catalog/generate-catalog.js';
      const queryPath = '../../../../mock-server/src/catalog/query-products.js';
      products = ((await import(catalogPath)) as { generateCatalog: () => unknown[] }).generateCatalog();
      server = (await import(queryPath)) as Server;
    } catch {
      return;
    }
    const run = (input: Parameters<typeof buildProductQueryArgs>[0], page = 1) => {
      const raw = Object.fromEntries(
        new URLSearchParams(toProductQueryString(buildProductQueryArgs(input), page)),
      );
      return server.queryProducts(products, raw);
    };

    const all = run({});
    assert.equal(all.total, 300);
    assert.equal(all.items.length, 20);

    const stocked = run({ inStock: true, topRated: true });
    assert.ok(stocked.total > 0 && stocked.total < 300);
    assert.ok(stocked.items.every((p) => p.inStock && p.rating >= 4));

    const brands = run({ brands: ['Solstice Grove', 'AsterVale Nutrition'] });
    assert.ok(brands.items.every((p) => ['Solstice Grove', 'AsterVale Nutrition'].includes(p.brand)));
    assert.ok(brands.total > run({ brands: ['Solstice Grove'] }).total, 'OR inside the same facet');

    const and = run({ brands: ['Solstice Grove'], subcategories: ['zinc'] });
    assert.ok(and.items.every((p) => p.brand === 'Solstice Grove' && p.subcategoryId === 'zinc'));

    // Diacritics and case do not matter to the server and do not change our identity.
    assert.equal(run({ search: 'ÁCIDO' }).total, run({ search: ' acido ' }).total);
    assert.equal(run({}, 2).page, 2);
  });
});

describe('describeQueryForLog', () => {
  it('lists category, the four filters as the server receives them, sort and page', () => {
    const args = buildProductQueryArgs({
      category: 'vitamins',
      inStock: true,
      topRated: true,
      ownBrand: true,
      subscribeAndSave: true,
      sort: 'price_desc',
    });
    assert.equal(
      describeQueryForLog(args, 2),
      'category=vitamins inStock=true minRating=4 ownBrand=true subscribeAndSave=true sort=price_desc page=2',
    );
  });

  it('omits the filters that are off', () => {
    assert.equal(
      describeQueryForLog(buildProductQueryArgs({ category: 'vitamins' }), 1),
      'category=vitamins sort=featured page=1',
    );
  });

  it('never prints the search text or the facet values, only that they are present', () => {
    const args = buildProductQueryArgs({
      search: 'private words',
      brands: ['Solstice Grove', 'AsterVale'],
      subcategories: ['vitamin-d'],
    });
    const line = describeQueryForLog(args, 1);
    assert.equal(line, 'search=on brands=2 subcategories=1 sort=featured page=1');
    assert.equal(line.includes('private'), false);
    assert.equal(line.includes('solstice'), false);
  });
});
