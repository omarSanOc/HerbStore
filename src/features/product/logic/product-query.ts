// Query identity for the product list (pure logic: no React Native, no RTK values).
//
// The cache key of a RTK Query entry is the serialized ARG. If two screens ask for the same list
// with different spelling ("Vitamina Ç" vs "vitamina c", brands in a different order), a raw arg
// would create two entries and two requests. So the arg is built canonical here: equivalent
// queries become deeply equal, and the default serializer then shares cache and in-flight request.
// The PAGE is deliberately not part of the arg: it is the infinite query's `pageParam`, so every
// page of one list lives in one entry (refetch, abort and "reset to the top" act on the list).

import type { SupportedLanguage } from '../../../core/i18n/languages.ts';

export const PRODUCT_SORTS = [
  'featured',
  'price_asc',
  'price_desc',
  'rating',
  'best_selling',
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number];

/** Page size; `GET /products` accepts 1-50 and defaults to 20. */
export const PRODUCT_LIST_LIMIT = 20;

/** The "4★ or more" quick filter sends `minRating=4`. */
export const TOP_RATED_MIN_RATING = 4;

/**
 * Canonical identity of one product list. Inactive flags have NO key (`inStock: false` would be a
 * different identity from "no key" for the serializer, though both mean the same). Facets are
 * normalized, deduplicated and sorted. No `page`.
 *
 * `language` is part of the identity and is NOT sent as a query parameter: the same filters in
 * `es` and in `en` are two cache entries with two in-flight requests (RF-24, RF-26, RNF-5). The
 * header carries it (`Accept-Language`) through the base query (T1).
 */
export type ProductQueryArgs = Readonly<{
  /** The effective language of the read (`es` | `en`): identity, never a `?` parameter. */
  language: SupportedLanguage;
  /** Category id from the route (`GET /products?category=`). */
  category?: string;
  /** Normalized search text (`q`): brand, name and description on the server. */
  q?: string;
  /** Brand names, normalized. OR inside the facet. */
  brand?: readonly string[];
  /** Subcategory ids, normalized. OR inside the facet. */
  subcategory?: readonly string[];
  inStock?: true;
  minRating?: typeof TOP_RATED_MIN_RATING;
  ownBrand?: true;
  subscribeAndSave?: true;
  sort: ProductSort;
  limit: typeof PRODUCT_LIST_LIMIT;
}>;

/** What a screen knows, in the user's spelling. `buildProductQueryArgs` canonicalizes it. */
export type ProductQueryInput = Readonly<{
  /** The effective language of the read: required, so no query can be built without one. */
  language: SupportedLanguage;
  category?: string;
  /** Raw search text, as typed. */
  search?: string;
  brands?: readonly string[];
  subcategories?: readonly string[];
  inStock?: boolean;
  /** "4★ or more". */
  topRated?: boolean;
  ownBrand?: boolean;
  subscribeAndSave?: boolean;
  sort?: ProductSort;
}>;

/**
 * Normalized form of a search text: no outer spaces, inner runs of whitespace as one space,
 * lowercase and no diacritics (NFD splits "ç" into "c" + a combining mark, then every mark is
 * dropped). Same steps and order as the API's own text normalization (search matches on the
 * server side, RF-11), so both sides agree on what "the same text" means. The UI keeps the
 * human text; this is only the identity.
 */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Normalizes, drops empties and duplicates, and sorts (code-unit order: deterministic). */
function normalizeFacet(values: readonly string[] | undefined): string[] {
  if (values === undefined) {
    return [];
  }

  return [...new Set(values.map(normalizeSearchText).filter((value) => value !== ''))].sort();
}

export function buildProductQueryArgs(input: ProductQueryInput): ProductQueryArgs {
  const category = normalizeSearchText(input.category ?? '');
  const q = normalizeSearchText(input.search ?? '');
  const brand = normalizeFacet(input.brands);
  const subcategory = normalizeFacet(input.subcategories);

  // Fixed insertion order: even `JSON.stringify` of equivalent args is identical.
  // `language` leads so a serialized identity names the cache it belongs to at a glance.
  return {
    language: input.language,
    ...(category === '' ? {} : { category }),
    ...(q === '' ? {} : { q }),
    ...(brand.length === 0 ? {} : { brand }),
    ...(subcategory.length === 0 ? {} : { subcategory }),
    ...(input.inStock === true ? { inStock: true as const } : {}),
    ...(input.topRated === true ? { minRating: TOP_RATED_MIN_RATING } : {}),
    ...(input.ownBrand === true ? { ownBrand: true as const } : {}),
    ...(input.subscribeAndSave === true ? { subscribeAndSave: true as const } : {}),
    sort: input.sort ?? 'featured',
    limit: PRODUCT_LIST_LIMIT,
  };
}

/**
 * Query string (without `?`) for `GET /products`. `brand` and `subcategory` are CSV: the commas
 * between values stay literal and each value is encoded on its own, so a value cannot inject a
 * separator or a parameter. (A value that itself contains a comma cannot be expressed in the
 * server's CSV; brands and subcategory ids come from `GET /brands` and `GET /categories`, which
 * have none.)
 *
 * The page is a request detail, not identity, so it is a separate argument. The language is not
 * serialized either: it travels as `Accept-Language` (T1), never as a parameter of `/products`,
 * and the server's contract for this path does not include one.
 */
export function toProductQueryString(args: ProductQueryArgs, page: number): string {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError('page must be a positive integer');
  }

  const parts: string[] = [];
  const add = (key: string, value: string) => parts.push(`${key}=${value}`);
  const csv = (values: readonly string[]) => values.map(encodeURIComponent).join(',');

  if (args.category !== undefined) {
    add('category', encodeURIComponent(args.category));
  }
  if (args.q !== undefined) {
    add('q', encodeURIComponent(args.q));
  }
  if (args.brand !== undefined && args.brand.length > 0) {
    add('brand', csv(args.brand));
  }
  if (args.subcategory !== undefined && args.subcategory.length > 0) {
    add('subcategory', csv(args.subcategory));
  }
  if (args.inStock === true) {
    add('inStock', 'true');
  }
  if (args.minRating !== undefined) {
    add('minRating', String(args.minRating));
  }
  if (args.ownBrand === true) {
    add('ownBrand', 'true');
  }
  if (args.subscribeAndSave === true) {
    add('subscribeAndSave', 'true');
  }
  add('sort', args.sort);
  add('page', String(page));
  add('limit', String(args.limit));

  return parts.join('&');
}

/**
 * One line that says what a request asks for, safe to print in development (no user data).
 *
 * The `[api]` log omits the query string on purpose, so this is how a developer checks that a
 * chip sends exactly `inStock=true` / `minRating=4` / ... The search text and the facet values
 * are NOT printed: only that they are present (and how many values a facet has).
 */
export function describeQueryForLog(args: ProductQueryArgs, page: number): string {
  // `lang` first: it says WHICH cache entry is being asked for (safe to print, not user data).
  const parts: string[] = [`lang=${args.language}`];

  if (args.category !== undefined) {
    parts.push(`category=${args.category}`);
  }
  if (args.q !== undefined) {
    parts.push('search=on');
  }
  if (args.brand !== undefined && args.brand.length > 0) {
    parts.push(`brands=${args.brand.length}`);
  }
  if (args.subcategory !== undefined && args.subcategory.length > 0) {
    parts.push(`subcategories=${args.subcategory.length}`);
  }
  if (args.inStock === true) {
    parts.push('inStock=true');
  }
  if (args.minRating !== undefined) {
    parts.push(`minRating=${args.minRating}`);
  }
  if (args.ownBrand === true) {
    parts.push('ownBrand=true');
  }
  if (args.subscribeAndSave === true) {
    parts.push('subscribeAndSave=true');
  }
  parts.push(`sort=${args.sort}`, `page=${page}`);

  return parts.join(' ');
}
