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
  type ProductQueryInput,
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

  it('normalizes each wire sample to the value the search contract pins down', () => {
    // These rows were once compared against the backend's own `normalize-text.js`; the parity with
    // the live API belongs to the opt-in smoke, and the table now pins the expected values (RF-11).
    const rows: readonly (readonly [string, string])[] = [
      ['  Vitamina   Ç ', 'vitamina c'],
      ['ÁCIDO Fólico', 'acido folico'],
      ['Omega-3  ', 'omega-3'],
      ['ñandú\t', 'nandu'],
      ['AsterVale', 'astervale'],
    ];
    for (const [sample, expected] of rows) {
      assert.equal(normalizeSearchText(sample), expected, sample);
    }
  });
});

describe('buildProductQueryArgs: canonical identity', () => {
  it('gives deeply equal args for equivalent inputs (case, diacritics, spaces and order)', () => {
    const a = buildProductQueryArgs({
      language: 'es',
      category: 'vitamins',
      search: '  Vitamina   Ç ',
      brands: ['Solstice Grove', 'AsterVale Nutrition'],
      subcategories: ['vitamin-d', 'Vitamin-C'],
      inStock: true,
      sort: 'price_asc',
    });
    const b = buildProductQueryArgs({
      language: 'es',
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
      language: 'es',
      brands: ['b', 'A', 'b', ' a '],
      subcategories: ['z', 'y', 'z'],
    });

    assert.deepEqual(args.brand, ['a', 'b']);
    assert.deepEqual(args.subcategory, ['y', 'z']);
  });

  it('omits every inactive or empty key', () => {
    const args = buildProductQueryArgs({
      language: 'es',
      search: '   ',
      category: '  ',
      brands: [],
      subcategories: ['  '],
      inStock: false,
      topRated: false,
      ownBrand: false,
      subscribeAndSave: false,
    });

    assert.deepEqual(args, { language: 'es', sort: 'featured', limit: PRODUCT_LIST_LIMIT });
    for (const key of ['q', 'category', 'brand', 'subcategory', 'inStock', 'minRating', 'ownBrand', 'subscribeAndSave']) {
      assert.equal(key in args, false, key);
    }
  });

  it('maps each active quick filter to its wire value', () => {
    const args = buildProductQueryArgs({
      language: 'es',
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
    const args = buildProductQueryArgs({ language: 'es' });

    assert.equal(args.sort, 'featured');
    assert.equal(args.limit, 20);
    assert.equal('page' in args, false);
  });

  it('keeps the exact sort values', () => {
    assert.deepEqual(PRODUCT_SORTS, ['featured', 'price_asc', 'price_desc', 'rating', 'best_selling']);
    for (const sort of PRODUCT_SORTS) {
      assert.equal(buildProductQueryArgs({ language: 'es', sort }).sort, sort);
    }
  });

  it('different filters are different identities', () => {
    const base = buildProductQueryArgs({ language: 'es', search: 'zinc' });

    assert.notDeepEqual(base, buildProductQueryArgs({ language: 'es', search: 'zinc', inStock: true }));
    assert.notDeepEqual(base, buildProductQueryArgs({ language: 'es', search: 'zinc', sort: 'rating' }));
    assert.notDeepEqual(base, buildProductQueryArgs({ language: 'es', search: 'zinc', brands: ['a'] }));
    assert.notDeepEqual(base, buildProductQueryArgs({ language: 'es', search: 'magnesium' }));
  });

  it('does not mutate its input or share arrays with it', () => {
    const brands = ['b', 'a'];
    const input = Object.freeze({ language: 'es' as const, brands: Object.freeze(brands) });
    const args = buildProductQueryArgs(input);

    assert.deepEqual(brands, ['b', 'a']);
    assert.notEqual(args.brand, brands);
  });
});

describe('toProductQueryString', () => {
  it('serializes every parameter, facets as CSV with each value encoded', () => {
    const args = buildProductQueryArgs({
      language: 'es',
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
      toProductQueryString(buildProductQueryArgs({ language: 'es' }), 1),
      'sort=featured&page=1&limit=20',
    );
  });

  it('encodes reserved characters in every value but keeps the CSV separator', () => {
    const args: ProductQueryArgs = {
      language: 'es',
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
      toProductQueryString(buildProductQueryArgs({ language: 'es', subcategories: ['zinc'] }), 1),
      'subcategory=zinc&sort=featured&page=1&limit=20',
    );
  });

  it('sends each quick filter exactly', () => {
    const only = (input: Omit<ProductQueryInput, 'language'>) =>
      toProductQueryString(buildProductQueryArgs({ language: 'es', ...input }), 1);

    assert.match(only({ inStock: true }), /(^|&)inStock=true(&|$)/);
    assert.match(only({ topRated: true }), /(^|&)minRating=4(&|$)/);
    assert.match(only({ ownBrand: true }), /(^|&)ownBrand=true(&|$)/);
    assert.match(only({ subscribeAndSave: true }), /(^|&)subscribeAndSave=true(&|$)/);
  });

  it('rejects a page that is not a positive integer', () => {
    const args = buildProductQueryArgs({ language: 'es' });

    for (const page of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => toProductQueryString(args, page), RangeError, String(page));
    }
  });

  it('the page changes the URL but never the identity', () => {
    const args = buildProductQueryArgs({ language: 'es', search: 'zinc' });

    assert.notEqual(toProductQueryString(args, 1), toProductQueryString(args, 2));
    assert.equal(JSON.stringify(args).includes('page'), false);
  });
});

// The query parameters are a contract with the API (RF-10 to RF-12): this table pins the exact
// vocabulary we send for each input. How the server combines them (OR inside a facet, AND across
// facets, normalized search, filters before totals) is the API's side of the contract and is
// checked by the opt-in live smoke, not by the unit suite (RF-41).
describe('toProductQueryString: the wire contract each input sends', () => {
  const entries = (input: Omit<ProductQueryInput, 'language'>, page = 1) =>
    Object.fromEntries(
      new URLSearchParams(toProductQueryString(buildProductQueryArgs({ language: 'es', ...input }), page)),
    );

  const cases: readonly (readonly [string, Omit<ProductQueryInput, 'language'>, Record<string, string>])[] = [
    ['an unfiltered request only declares sort, page and limit', {}, {}],
    ['several brands arrive as one sorted CSV (the OR facet)', { brands: ['Solstice Grove', 'AsterVale Nutrition'] }, { brand: 'astervale nutrition,solstice grove' }],
    ['several subcategories arrive as one sorted CSV', { subcategories: ['zinc', 'vitamin-d'] }, { subcategory: 'vitamin-d,zinc' }],
    ['the stock filter arrives as inStock=true', { inStock: true }, { inStock: 'true' }],
    ['the top-rated filter arrives as minRating=4', { topRated: true }, { minRating: '4' }],
    ['own brand and subscription arrive as their own flags', { ownBrand: true, subscribeAndSave: true }, { ownBrand: 'true', subscribeAndSave: 'true' }],
    ['a sort from the allowed list travels verbatim', { sort: 'price_asc' }, { sort: 'price_asc' }],
    ['the search travels normalized (RF-11)', { search: '  ÁCIDO   Fólico ' }, { q: 'acido folico' }],
    ['a category travels as its id', { category: 'vitamins' }, { category: 'vitamins' }],
  ];

  for (const [label, input, extra] of cases) {
    it(label, () => {
      assert.deepEqual(entries(input), { sort: 'featured', page: '1', limit: '20', ...extra });
    });
  }

  it('the page is one-based and travels as page', () => {
    assert.equal(entries({}, 2).page, '2');
  });

  it('brands and subcategories travel together (AND across facets)', () => {
    const params = entries({ brands: ['Solstice Grove'], subcategories: ['zinc'] });
    assert.equal(params.brand, 'solstice grove');
    assert.equal(params.subcategory, 'zinc');
  });
});

describe('describeQueryForLog', () => {
  it('lists category, the four filters as the server receives them, sort and page', () => {
    const args = buildProductQueryArgs({
      language: 'es',
      category: 'vitamins',
      inStock: true,
      topRated: true,
      ownBrand: true,
      subscribeAndSave: true,
      sort: 'price_desc',
    });
    assert.equal(
      describeQueryForLog(args, 2),
      'lang=es category=vitamins inStock=true minRating=4 ownBrand=true subscribeAndSave=true sort=price_desc page=2',
    );
  });

  it('omits the filters that are off', () => {
    assert.equal(
      describeQueryForLog(buildProductQueryArgs({ language: 'es', category: 'vitamins' }), 1),
      'lang=es category=vitamins sort=featured page=1',
    );
  });

  it('never prints the search text or the facet values, only that they are present', () => {
    const args = buildProductQueryArgs({
      language: 'es',
      search: 'private words',
      brands: ['Solstice Grove', 'AsterVale'],
      subcategories: ['vitamin-d'],
    });
    const line = describeQueryForLog(args, 1);
    assert.equal(line, 'lang=es search=on brands=2 subcategories=1 sort=featured page=1');
    assert.equal(line.includes('private'), false);
    assert.equal(line.includes('solstice'), false);
  });
});
