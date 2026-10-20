/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyAdvancedFilters,
  clearFilters,
  countActiveFilters,
  countAdvancedFilters,
  DEFAULT_LIST_PARAMS,
  describeParamsForLog,
  hasActiveFilters,
  QUICK_FILTER_KEYS,
  setSort,
  toggleFacetValue,
  toggleQuickFilter,
  toProductQueryArgs,
  type ListParams,
} from './list-params.ts';
import { PRODUCT_SORTS, toProductQueryString, type ProductSort } from './product-query.ts';

/** Deep-frozen copy: any write in the code under test throws (the test files are strict). */
function frozen(params: ListParams): ListParams {
  return Object.freeze({
    ...params,
    brands: Object.freeze([...params.brands]),
    subcategories: Object.freeze([...params.subcategories]),
  });
}

describe('DEFAULT_LIST_PARAMS', () => {
  it('has no quick filter, the default sort and no brand or subcategory', () => {
    assert.deepEqual(DEFAULT_LIST_PARAMS, {
      inStock: false,
      topRated: false,
      ownBrand: false,
      subscribeAndSave: false,
      sort: 'featured',
      brands: [],
      subcategories: [],
    });
  });
});

describe('toggleQuickFilter', () => {
  it('lists exactly the four quick filters of RF-13', () => {
    assert.deepEqual([...QUICK_FILTER_KEYS], ['inStock', 'topRated', 'ownBrand', 'subscribeAndSave']);
  });

  for (const key of QUICK_FILTER_KEYS) {
    it(`turns ${key} on and off, touching nothing else`, () => {
      const start = frozen(DEFAULT_LIST_PARAMS);
      const on = toggleQuickFilter(start, key);
      assert.equal(on[key], true);
      assert.deepEqual(on, { ...DEFAULT_LIST_PARAMS, [key]: true });

      const off = toggleQuickFilter(frozen(on), key);
      assert.equal(off[key], false);
      assert.deepEqual(off, DEFAULT_LIST_PARAMS);
    });
  }

  it('keeps the other active filters and the sort', () => {
    const start = frozen({ ...DEFAULT_LIST_PARAMS, inStock: true, sort: 'price_asc' });
    const next = toggleQuickFilter(start, 'ownBrand');
    assert.deepEqual(next, { ...DEFAULT_LIST_PARAMS, inStock: true, ownBrand: true, sort: 'price_asc' });
  });

  it('never mutates its input and returns a new object', () => {
    const start = frozen(DEFAULT_LIST_PARAMS);
    const next = toggleQuickFilter(start, 'topRated');
    assert.notEqual(next, start);
    assert.equal(start.topRated, false);
  });
});

describe('setSort', () => {
  it('accepts exactly the five sorts of RF-15', () => {
    for (const sort of PRODUCT_SORTS) {
      const next = setSort(frozen(DEFAULT_LIST_PARAMS), sort);
      assert.equal(next.sort, sort);
    }
    assert.deepEqual([...PRODUCT_SORTS], ['featured', 'price_asc', 'price_desc', 'rating', 'best_selling']);
  });

  it('keeps the filters when the sort changes', () => {
    const start = frozen({ ...DEFAULT_LIST_PARAMS, inStock: true, topRated: true });
    assert.deepEqual(setSort(start, 'rating'), { ...start, sort: 'rating' });
  });

  it('ignores a value that is not one of the five (same object, no change)', () => {
    const start = frozen({ ...DEFAULT_LIST_PARAMS, sort: 'rating' });
    for (const invalid of ['', 'newest', 'PRICE_ASC', 'price_asc ', 'constructor', 'rating,price_asc']) {
      assert.equal(setSort(start, invalid as ProductSort), start, invalid);
    }
  });

  it('returns the same object when the sort does not change', () => {
    const start = frozen(DEFAULT_LIST_PARAMS);
    assert.equal(setSort(start, 'featured'), start);
  });

  it('never mutates its input', () => {
    const start = frozen(DEFAULT_LIST_PARAMS);
    const next = setSort(start, 'price_desc');
    assert.equal(start.sort, 'featured');
    assert.notEqual(next, start);
  });
});

describe('clearFilters', () => {
  const everything = frozen({
    inStock: true,
    topRated: true,
    ownBrand: true,
    subscribeAndSave: true,
    sort: 'price_desc',
    brands: ['solstice grove'],
    subcategories: ['vitamin-d'],
  });

  it('turns every filter off in one step', () => {
    const next = clearFilters(everything);
    assert.equal(next.inStock, false);
    assert.equal(next.topRated, false);
    assert.equal(next.ownBrand, false);
    assert.equal(next.subscribeAndSave, false);
    assert.deepEqual(next.brands, []);
    assert.deepEqual(next.subcategories, []);
  });

  it('leaves the sort as it is (clearing filters is not clearing the order)', () => {
    assert.equal(clearFilters(everything).sort, 'price_desc');
  });

  it('gives the default values when only the filters were changed', () => {
    const next = clearFilters(frozen({ ...DEFAULT_LIST_PARAMS, inStock: true, ownBrand: true }));
    assert.deepEqual(next, DEFAULT_LIST_PARAMS);
  });

  it('never mutates its input', () => {
    const next = clearFilters(everything);
    assert.notEqual(next, everything);
    assert.equal(everything.inStock, true);
    assert.deepEqual(everything.brands, ['solstice grove']);
  });
});

describe('hasActiveFilters / countActiveFilters', () => {
  it('is false for the default params, whatever the sort', () => {
    assert.equal(hasActiveFilters(DEFAULT_LIST_PARAMS), false);
    assert.equal(hasActiveFilters({ ...DEFAULT_LIST_PARAMS, sort: 'rating' }), false);
    assert.equal(countActiveFilters(DEFAULT_LIST_PARAMS), 0);
  });

  it('counts each active quick filter', () => {
    const params = { ...DEFAULT_LIST_PARAMS, inStock: true, subscribeAndSave: true };
    assert.equal(hasActiveFilters(params), true);
    assert.equal(countActiveFilters(params), 2);
  });
});

describe('toProductQueryArgs: screen state to canonical query', () => {
  it('sends nothing for the default params but the category, the sort and the limit', () => {
    assert.deepEqual(toProductQueryArgs({ category: 'vitamins' }, DEFAULT_LIST_PARAMS, 'es'), {
      language: 'es',
      category: 'vitamins',
      sort: 'featured',
      limit: 20,
    });
  });

  it('sends exactly inStock=true, minRating=4, ownBrand=true and subscribeAndSave=true', () => {
    const cases = [
      ['inStock', 'inStock=true'],
      ['topRated', 'minRating=4'],
      ['ownBrand', 'ownBrand=true'],
      ['subscribeAndSave', 'subscribeAndSave=true'],
    ] as const;
    for (const [key, expected] of cases) {
      const params = toggleQuickFilter(DEFAULT_LIST_PARAMS, key);
      const query = toProductQueryString(toProductQueryArgs({ category: 'vitamins' }, params, 'es'), 1);
      assert.equal(query, `category=vitamins&${expected}&sort=featured&page=1&limit=20`, key);
    }
  });

  it('sends the four flags and the sort together', () => {
    const params: ListParams = {
      ...DEFAULT_LIST_PARAMS,
      inStock: true,
      topRated: true,
      ownBrand: true,
      subscribeAndSave: true,
      sort: 'best_selling',
    };
    assert.equal(
      toProductQueryString(toProductQueryArgs({ category: 'minerals' }, params, 'es'), 2),
      'category=minerals&inStock=true&minRating=4&ownBrand=true&subscribeAndSave=true&sort=best_selling&page=2&limit=20',
    );
  });

  it('gives different identities for different filters or sorts, and equal ones for equal state', () => {
    const identity = (params: ListParams) =>
      JSON.stringify(toProductQueryArgs({ category: 'vitamins' }, params, 'es'));
    const inStock = toggleQuickFilter(DEFAULT_LIST_PARAMS, 'inStock');
    assert.notEqual(identity(inStock), identity(DEFAULT_LIST_PARAMS));
    assert.notEqual(identity(setSort(inStock, 'rating')), identity(inStock));
    assert.equal(identity(toggleQuickFilter(inStock, 'inStock')), identity(DEFAULT_LIST_PARAMS));
    assert.equal(identity(inStock), identity({ ...inStock }));
  });

  it('puts the T11 facets in the identity already (empty ones add nothing)', () => {
    const args = toProductQueryArgs(
      { category: 'vitamins' },
      { ...DEFAULT_LIST_PARAMS, brands: ['B', 'a'], subcategories: ['vitamin-d'] },
      'es',
    );
    assert.deepEqual(args.brand, ['a', 'b']);
    assert.deepEqual(args.subcategory, ['vitamin-d']);
  });

  it('keeps the search text for the future search screen', () => {
    const args = toProductQueryArgs({ search: '  Vitamina   Ç ' }, DEFAULT_LIST_PARAMS, 'es');
    assert.equal(args.q, 'vitamina c');
    assert.equal(args.category, undefined);
  });
});

describe('describeParamsForLog', () => {
  it('names the active filters and the sort, nothing else', () => {
    const params: ListParams = { ...DEFAULT_LIST_PARAMS, inStock: true, topRated: true, sort: 'price_asc' };
    assert.equal(describeParamsForLog(params), 'filters inStock,topRated sort=price_asc');
  });

  it('says "none" when no filter is on', () => {
    assert.equal(describeParamsForLog(DEFAULT_LIST_PARAMS), 'filters none sort=featured');
  });
});

describe('applyAdvancedFilters (draft to applied, T11)', () => {
  const applied = frozen({
    inStock: true,
    topRated: false,
    ownBrand: true,
    subscribeAndSave: false,
    sort: 'price_desc',
    brands: ['Solstice Grove'],
    subcategories: ['vitamin-c'],
  });

  it('REPLACES the brands and the subcategories, it does not add to them', () => {
    const next = applyAdvancedFilters(applied, {
      brands: ['Juniper Axis', 'Verdant Forge'],
      subcategories: ['zinc'],
    });
    assert.deepEqual(next.brands, ['Juniper Axis', 'Verdant Forge']);
    assert.deepEqual(next.subcategories, ['zinc']);
  });

  it('can empty a facet (an empty draft removes what was applied)', () => {
    const next = applyAdvancedFilters(applied, { brands: [], subcategories: ['vitamin-c'] });
    assert.deepEqual(next.brands, []);
    assert.deepEqual(next.subcategories, ['vitamin-c']);
  });

  it('keeps the sort and the four quick filters as they were', () => {
    const next = applyAdvancedFilters(applied, { brands: ['Juniper Axis'], subcategories: [] });
    assert.equal(next.sort, 'price_desc');
    assert.equal(next.inStock, true);
    assert.equal(next.topRated, false);
    assert.equal(next.ownBrand, true);
    assert.equal(next.subscribeAndSave, false);
  });

  it('never mutates the applied params nor the draft, and returns a new object', () => {
    const draft = {
      brands: Object.freeze(['Juniper Axis']),
      subcategories: Object.freeze(['zinc', 'calcium']),
    };
    const next = applyAdvancedFilters(applied, draft);
    assert.notEqual(next, applied);
    assert.deepEqual(applied.brands, ['Solstice Grove']);
    assert.deepEqual(applied.subcategories, ['vitamin-c']);
    assert.notEqual(next.brands, draft.brands);
    assert.notEqual(next.subcategories, draft.subcategories);
  });

  it('drops repeated values of the draft', () => {
    const next = applyAdvancedFilters(DEFAULT_LIST_PARAMS, {
      brands: ['Juniper Axis', 'Juniper Axis'],
      subcategories: ['zinc', 'zinc', 'calcium'],
    });
    assert.deepEqual(next.brands, ['Juniper Axis']);
    assert.deepEqual(next.subcategories, ['zinc', 'calcium']);
  });

  it('returns the SAME object when the draft holds the same values (Apply with no change = no request)', () => {
    assert.equal(
      applyAdvancedFilters(applied, { brands: ['Solstice Grove'], subcategories: ['vitamin-c'] }),
      applied,
    );
    // The order of the values is not a change: the query identity sorts them.
    const two = frozen({ ...DEFAULT_LIST_PARAMS, brands: ['A', 'B'] });
    assert.equal(applyAdvancedFilters(two, { brands: ['B', 'A'], subcategories: [] }), two);
    assert.equal(applyAdvancedFilters(DEFAULT_LIST_PARAMS, { brands: [], subcategories: [] }), DEFAULT_LIST_PARAMS);
  });

  it('CANCEL is "do not call it": the applied params only change when Apply runs', () => {
    // Cancel, the Close button, the drag gesture, Android Back and the backdrop never reach
    // `applyAdvancedFilters`, so the applied value is the very same object afterwards.
    // The draft is a copy and editing it (`toggleFacetValue`) leaves the applied arrays alone.
    const draftBrands = toggleFacetValue(applied.brands, 'Juniper Axis');
    assert.deepEqual(draftBrands, ['Solstice Grove', 'Juniper Axis']);
    assert.deepEqual(applied.brands, ['Solstice Grove']);
    assert.deepEqual(applied.subcategories, ['vitamin-c']);
  });

  it('sends brand=a,b and subcategory=x, sorted, whatever the order the user picked them in', () => {
    const query = (brands: string[], subcategories: string[]) =>
      toProductQueryString(
        toProductQueryArgs(
          { category: 'vitamins' },
          applyAdvancedFilters(DEFAULT_LIST_PARAMS, { brands, subcategories }),
          'es',
        ),
        1,
      );
    assert.equal(
      query(['Solstice Grove', 'Juniper Axis'], ['vitamin-c']),
      'category=vitamins&brand=juniper%20axis,solstice%20grove&subcategory=vitamin-c&sort=featured&page=1&limit=20',
    );
    assert.equal(
      query(['Solstice Grove', 'Juniper Axis'], ['vitamin-c']),
      query(['Juniper Axis', 'Solstice Grove'], ['vitamin-c']),
    );
  });

  it('gives an EQUIVALENT query (same identity, one cache entry) for the same set in another order', () => {
    const identity = (brands: string[]) =>
      JSON.stringify(
        toProductQueryArgs(
          { category: 'vitamins' },
          applyAdvancedFilters(DEFAULT_LIST_PARAMS, { brands, subcategories: [] }),
          'es',
        ),
      );
    assert.equal(identity(['A', 'b']), identity(['B', 'a']));
    assert.notEqual(identity(['A']), identity(['A', 'b']));
  });
});

describe('toggleFacetValue (draft editing, T11)', () => {
  it('adds a value that is not there, at the end', () => {
    assert.deepEqual(toggleFacetValue(Object.freeze(['a']), 'b'), ['a', 'b']);
  });

  it('removes a value that is there and keeps the others in order', () => {
    assert.deepEqual(toggleFacetValue(Object.freeze(['a', 'b', 'c']), 'b'), ['a', 'c']);
  });

  it('never mutates its input', () => {
    const input = Object.freeze(['a']);
    const next = toggleFacetValue(input, 'b');
    assert.notEqual(next, input);
    assert.deepEqual(input, ['a']);
  });
});

describe('countAdvancedFilters', () => {
  it('counts brands plus subcategories and ignores the four quick filters and the sort', () => {
    assert.equal(countAdvancedFilters(DEFAULT_LIST_PARAMS), 0);
    assert.equal(
      countAdvancedFilters({
        ...DEFAULT_LIST_PARAMS,
        inStock: true,
        ownBrand: true,
        sort: 'rating',
      }),
      0,
    );
    assert.equal(
      countAdvancedFilters({
        ...DEFAULT_LIST_PARAMS,
        inStock: true,
        brands: ['a', 'b'],
        subcategories: ['x'],
      }),
      3,
    );
  });
});

describe('clearFilters with the advanced facets (T11)', () => {
  it('empties brands and subcategories too, and keeps the sort', () => {
    const next = clearFilters(
      frozen({
        ...DEFAULT_LIST_PARAMS,
        sort: 'best_selling',
        brands: ['a'],
        subcategories: ['x', 'y'],
      }),
    );
    assert.deepEqual(next.brands, []);
    assert.deepEqual(next.subcategories, []);
    assert.equal(next.sort, 'best_selling');
    assert.equal(countAdvancedFilters(next), 0);
  });
});

describe('describeParamsForLog with the advanced facets (T11)', () => {
  it('says how many brands and subcategories, never their values', () => {
    const params: ListParams = { ...DEFAULT_LIST_PARAMS, brands: ['a', 'b'], subcategories: ['x'] };
    assert.equal(describeParamsForLog(params), 'filters brands=2,subcategories=1 sort=featured');
    assert.equal(
      describeParamsForLog({ ...params, inStock: true }),
      'filters inStock,brands=2,subcategories=1 sort=featured',
    );
  });
});
