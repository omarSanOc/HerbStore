// Applied parameters of a product list screen (pure logic: no React Native, no RTK values).
//
// A list has TWO kinds of input. What the route decides (the category, later the search text) and
// what the user toggles on the screen (quick filters, sort, later brands and subcategories).
// This module owns the second kind as one immutable value and the pure steps that change it. The
// screen keeps that value in local state (`useState`), feeds it to `toProductQueryArgs` and the
// result is the identity of the RTK Query entry: change a filter and the identity changes, so
// the list starts again on page 1 and on top (RF-15). Nothing here is Redux or a URL parameter.

import {
  buildProductQueryArgs,
  PRODUCT_SORTS,
  type ProductQueryArgs,
  type ProductSort,
} from './product-query.ts';

/** The four quick filters of RF-13, in the order the chips are drawn. */
export const QUICK_FILTER_KEYS = ['inStock', 'topRated', 'ownBrand', 'subscribeAndSave'] as const;

export type QuickFilterKey = (typeof QUICK_FILTER_KEYS)[number];

/**
 * What the user has applied on the screen. `brands` and `subcategories` are the advanced filters
 * (T11): the sheet edits a DRAFT copy and only `applyAdvancedFilters` writes them here.
 */
export type ListParams = Readonly<{
  /** "Available": `inStock=true`. */
  inStock: boolean;
  /** "4★ or more": `minRating=4`. */
  topRated: boolean;
  /** "Own brand": `ownBrand=true`. */
  ownBrand: boolean;
  /** "Subscribe and save": `subscribeAndSave=true`. */
  subscribeAndSave: boolean;
  sort: ProductSort;
  /** Brand names exactly as `GET /brands` sends them. OR inside the facet (RF-14). */
  brands: readonly string[];
  /** Subcategory ids exactly as `GET /categories` sends them. OR inside the facet (RF-14). */
  subcategories: readonly string[];
}>;

/**
 * What the advanced-filters sheet edits before the user presses Apply. A plain value, local to
 * the sheet: nothing outside sees it until `applyAdvancedFilters` turns it into applied params.
 */
export type AdvancedFiltersDraft = Readonly<{
  brands: readonly string[];
  subcategories: readonly string[];
}>;

export const DEFAULT_SORT: ProductSort = 'featured';

export const DEFAULT_LIST_PARAMS: ListParams = {
  inStock: false,
  topRated: false,
  ownBrand: false,
  subscribeAndSave: false,
  sort: DEFAULT_SORT,
  brands: [],
  subcategories: [],
};

/** What the route decides and the user cannot toggle on the screen. */
export type ListScope = Readonly<{
  category?: string;
  /** Raw search text, as typed (T12). */
  search?: string;
}>;

/** Activates or deactivates ONE quick filter. A new object; the input is never touched. */
export function toggleQuickFilter(params: ListParams, key: QuickFilterKey): ListParams {
  return { ...params, [key]: !params[key] };
}

function isProductSort(value: unknown): value is ProductSort {
  return PRODUCT_SORTS.some((sort) => sort === value);
}

/**
 * Changes the sort. A value that is not exactly one of the five is IGNORED and the same object
 * comes back: the type already forbids it, so a bad value can only come from a cast, and the
 * safest answer for a screen is "nothing changed" (the request would otherwise carry a `sort`
 * the server rejects). Choosing the sort that is already active also returns the same object.
 */
export function setSort(params: ListParams, sort: ProductSort): ListParams {
  if (!isProductSort(sort) || sort === params.sort) {
    return params;
  }

  return { ...params, sort };
}

/**
 * "Clear filters" (RF-19): every filter off in ONE step. The sort is NOT a filter, so it stays
 * (the spec says "clear search/filters"; the user's order is a view preference and the empty list
 * would otherwise jump to a different order for no visible reason).
 */
export function clearFilters(params: ListParams): ListParams {
  return {
    ...params,
    inStock: false,
    topRated: false,
    ownBrand: false,
    subscribeAndSave: false,
    brands: [],
    subcategories: [],
  };
}

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function hasSameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

/**
 * "Apply" in the advanced-filters sheet (RF-14): the draft REPLACES the applied brands and
 * subcategories. It does not add to them, so un-checking a brand in the draft removes it.
 * The sort and the four quick filters are not touched.
 *
 * "Cancel" has no function here on purpose: cancelling (the Cancel button, Close, the drag
 * gesture, Android Back or a tap on the backdrop) just never calls this, so the applied params
 * stay the same object and no request is made. The draft dies with the sheet.
 *
 * A draft with the same values as the applied ones (in any order: the query identity sorts them)
 * returns the SAME object, so applying without a change is not a new query.
 */
export function applyAdvancedFilters(params: ListParams, draft: AdvancedFiltersDraft): ListParams {
  const brands = uniqueValues(draft.brands);
  const subcategories = uniqueValues(draft.subcategories);

  if (hasSameValues(params.brands, brands) && hasSameValues(params.subcategories, subcategories)) {
    return params;
  }

  return { ...params, brands, subcategories };
}

/** Adds the value to a draft facet when it is missing and removes it when it is there. New array. */
export function toggleFacetValue(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

/**
 * What the counter of the "Filters" button shows: brands plus subcategories, i.e. exactly what
 * the sheet edits. The four quick filters are NOT counted: they are chips that already show
 * their own selected state in the bar, and a number that included them would not match the
 * selections the user finds when opening the sheet.
 */
export function countAdvancedFilters(params: ListParams): number {
  return params.brands.length + params.subcategories.length;
}

/** How many filters are on (quick filters, brands and subcategories; the sort does not count). */
export function countActiveFilters(params: ListParams): number {
  return (
    QUICK_FILTER_KEYS.filter((key) => params[key]).length +
    params.brands.length +
    params.subcategories.length
  );
}

export function hasActiveFilters(params: ListParams): boolean {
  return countActiveFilters(params) > 0;
}

/** Screen state to the canonical identity of the query (`buildProductQueryArgs` normalizes it). */
export function toProductQueryArgs(scope: ListScope, params: ListParams): ProductQueryArgs {
  return buildProductQueryArgs({
    ...scope,
    inStock: params.inStock,
    topRated: params.topRated,
    ownBrand: params.ownBrand,
    subscribeAndSave: params.subscribeAndSave,
    sort: params.sort,
    brands: params.brands,
    subcategories: params.subcategories,
  });
}

/**
 * For the development log when the user changes something: `filters inStock,topRated sort=rating`.
 * Brands and subcategories appear only as a count, never as values.
 */
export function describeParamsForLog(params: ListParams): string {
  const active: string[] = QUICK_FILTER_KEYS.filter((key) => params[key]);
  if (params.brands.length > 0) {
    active.push(`brands=${params.brands.length}`);
  }
  if (params.subcategories.length > 0) {
    active.push(`subcategories=${params.subcategories.length}`);
  }
  return `filters ${active.length === 0 ? 'none' : active.join(',')} sort=${params.sort}`;
}
