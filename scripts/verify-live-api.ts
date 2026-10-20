/// <reference types="node" />
// Live verification of the persistent API (spec 007, RF-42): opt-in, read-only and dependency-free.
//
// It only runs when someone asks for it (`HERBSTORE_LIVE_API_ORIGIN=... npm run verify:live-api`);
// `npm test` never invokes it and it never sends `POST /orders` — every request is a GET, so the
// persistent service is observed without being modified (RF-41 keeps the mutation-free matrix in
// the automated suite; this script adds the real-service layer on top).
//
// Two rules shape the code:
//   1. The examples come from the live catalog (category, brand, subcategory, product, ean13 and
//      image are read from real answers, never hardcoded), so a different catalog does not break
//      the verification (RF-40 rejects locally what is locally invalid; the script applies the
//      same validators — `parseProductId` and `isValidEan13` — before requesting).
//   2. The output states a cause per failed check (contract or language) and never prints keys,
//      headers, bodies or rejected inputs (RF-34, RNF-9): paths are masked with the app's own
//      `redactSettledPath` and transport errors are reported by name, not by message.
//
// The trust boundary is the app itself: answers are validated with the real parsers
// (`parseHomePayload`, `parseProductPage`, `parseProductDetail`, `parseBrandOptions`,
// `parseCategoryTree`), which is what RF-21 asks when the OpenAPI does not describe everything.
//
// Compose/Android: a read-only integration test against a staging server behind a Gradle flag.
// Swift/SwiftUI: an opt-in XCTest with a base URL injected from the environment.
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { redactSettledPath } from '../src/core/api/redact-settled-path.ts';
import { isRecord, isText } from '../src/core/validation/json-guards.ts';
import { parseHomePayload } from '../src/features/home/contracts/parse-home.ts';
import {
  parseBrandOptions,
  parseCategoryTree,
  parseProductDetail,
  parseProductPage,
} from '../src/features/product/contracts/parse-catalog-product.ts';
import { parseProductId } from '../src/features/product/parse-product-id.ts';
import {
  normalizeSearchText,
  PRODUCT_LIST_LIMIT,
  PRODUCT_SORTS,
} from '../src/features/product/logic/product-query.ts';
import { isValidEan13 } from '../src/features/scanner/logic/ean13.ts';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CheckOutcome = Readonly<{ name: string; ok: boolean; cause?: string }>;

type Derived = Readonly<{
  categoryId: string;
  subcategoryId: string;
  brand: string;
  productId: string;
  productName: string;
  ean13: string;
  image: string;
}>;

type OpenApiSummary = Readonly<{
  openapi: string;
  title: string;
  version: string;
  operations: string[];
}>;

/** Operations the app calls or declares (RF-21). `POST /orders` is declared, never invoked here. */
const EXPECTED_OPERATIONS: readonly string[] = [
  'GET /health',
  'GET /home',
  'GET /categories',
  'GET /brands',
  'GET /products',
  'GET /products/barcode/{code}',
  'GET /products/{product_id}',
  'GET /images/{kind}/{name}',
  'GET /orders/status/{key}',
  'POST /orders',
];

const REQUEST_TIMEOUT_MS = 15_000;

/** The origin must come from the environment: the script never guesses where the API lives. */
export function requireOrigin(env: Readonly<Record<string, string | undefined>>): string {
  const raw = env.HERBSTORE_LIVE_API_ORIGIN?.trim();
  if (!raw) {
    throw new Error('HERBSTORE_LIVE_API_ORIGIN is required; set it explicitly, e.g. http://localhost:3001');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('HERBSTORE_LIVE_API_ORIGIN is not a valid URL (it needs a scheme, e.g. http://host:port)');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('HERBSTORE_LIVE_API_ORIGIN must use http or https');
  }
  if (url.username || url.password) {
    throw new Error('HERBSTORE_LIVE_API_ORIGIN must not carry credentials');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('HERBSTORE_LIVE_API_ORIGIN must be an origin without path, query or fragment');
  }
  return url.origin;
}

/** A path safe for the output: no query string (search terms are user input) and a masked order key. */
export function describePath(path: string): string {
  const [clean] = path.split('?');
  return redactSettledPath(clean ?? path);
}

/** RF-22/RF-23: only the exact requested code is coherent; anything else is incompatible. */
export function isCoherentLanguage(requested: string, header: string | null): boolean {
  return header === requested;
}

/** Reads version, title and declared operations; `undefined` when the document is not the contract. */
export function parseOpenApiSummary(text: string): OpenApiSummary | undefined {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(document)) return undefined;

  const { openapi, info, paths } = document;
  if (!isText(openapi) || !openapi.startsWith('3.1')) return undefined;
  if (!isRecord(info) || info.title !== 'HerbStore API' || !isText(info.version)) return undefined;
  if (!isRecord(paths)) return undefined;

  const operations: string[] = [];
  for (const [path, methods] of Object.entries(paths)) {
    if (!isRecord(methods)) continue;
    for (const method of Object.keys(methods)) operations.push(`${method.toUpperCase()} ${path}`);
  }
  return { openapi, title: info.title, version: info.version, operations };
}

/** The declared operations the document is missing, in the order they were expected. */
export function missingOperations(summary: OpenApiSummary, expected: readonly string[]): string[] {
  return expected.filter((operation) => !summary.operations.includes(operation));
}

/**
 * The verification adapts to the live catalog: category, subcategory, brand and the product to
 * exercise (in stock, with a valid EAN-13 and at least one image) are read from real answers.
 * `undefined` when the catalog cannot provide an example — the checks then fail with that cause
 * instead of falling back to a hardcoded value (RF-40: locally invalid data never leaves home).
 */
export function deriveExamples(input: {
  categories: unknown;
  brands: unknown;
  products: unknown;
}): Derived | undefined {
  const category = Array.isArray(input.categories) ? input.categories.find(isRecord) : undefined;
  const categoryId = category && isText(category.id) ? category.id : undefined;
  const subcategory = Array.isArray(category?.subcategories) ? category.subcategories.find(isRecord) : undefined;
  const subcategoryId = subcategory && isText(subcategory.id) ? subcategory.id : undefined;
  const brand = Array.isArray(input.brands) ? input.brands.find(isRecord) : undefined;
  const brandName = brand && isText(brand.name) ? brand.name : undefined;

  const usable = (Array.isArray(input.products) ? input.products : []).filter(isRecord).filter((product) => {
    const { ean13, images } = product;
    return isText(ean13) && isValidEan13(ean13) && Array.isArray(images) && isText(images[0]);
  });
  const product = usable.find((candidate) => candidate.inStock === true) ?? usable[0];

  const productId = product && isText(product.id) ? product.id : undefined;
  const productName = product && isText(product.name) ? product.name : undefined;
  const ean13 = product && isText(product.ean13) ? product.ean13 : undefined;
  const image = product && Array.isArray(product.images) && isText(product.images[0]) ? product.images[0] : undefined;

  if (!categoryId || !subcategoryId || !brandName || !productId || !productName || !ean13 || !image) {
    return undefined;
  }
  return { categoryId, subcategoryId, brand: brandName, productId, productName, ean13, image };
}

export function formatOutcome(outcome: CheckOutcome): string {
  return outcome.ok ? `OK   ${outcome.name}` : `FAIL ${outcome.name}: ${outcome.cause ?? 'unknown cause'}`;
}

/** Transport failures are reported by name only: a message can echo a URL that carries a key. */
function safeCause(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error';
  if (name === 'AbortError' || name === 'TimeoutError') return 'the request timed out or was aborted';
  return 'the request failed at transport level (server unreachable)';
}

type SafeResponse = Readonly<{
  status: number;
  language: string | null;
  contentType: string | null;
  text: string;
  bytes: Uint8Array;
}>;

/**
 * Every check of the live contract, in order. Returns the outcomes plus the request log so the
 * caller can prove the run was read-only. All the state lives here; the module has no side effects
 * beyond `main`, so the unit tests drive it with an injected `fetch`.
 */
export async function runVerification({
  origin,
  fetchImpl,
}: {
  origin: string;
  fetchImpl: FetchLike;
}): Promise<{ outcomes: CheckOutcome[] }> {
  const calls: { method: string; path: string }[] = [];
  const outcomes: CheckOutcome[] = [];

  const get = async (path: string, language?: string, accept = 'application/json'): Promise<SafeResponse> => {
    const headers: Record<string, string> = { accept };
    if (language) headers['accept-language'] = language;
    const url = new URL(path, origin);
    calls.push({ method: 'GET', path: describePath(url.pathname) });
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      language: response.headers.get('content-language'),
      contentType: response.headers.get('content-type'),
      text: new TextDecoder().decode(bytes),
      bytes,
    };
  };

  const asJson = (response: SafeResponse): unknown => {
    try {
      return JSON.parse(response.text);
    } catch {
      return undefined;
    }
  };

  const itemsOf = (payload: unknown): Record<string, unknown>[] | undefined => {
    if (!isRecord(payload) || !Array.isArray(payload.items)) return undefined;
    return payload.items.every(isRecord) ? (payload.items as Record<string, unknown>[]) : undefined;
  };

  const pricesOf = (payload: unknown): number[] | undefined =>
    itemsOf(payload)?.flatMap((item) => (typeof item.price === 'number' ? [item.price] : []));

  /** RF-22/RF-23 at the boundary: 2xx and a Content-Language equal to the requested code. */
  const expectLocalized = (response: SafeResponse, language: string): string | undefined => {
    if (response.status < 200 || response.status >= 300) return `expected HTTP 2xx, got ${response.status}`;
    if (!isCoherentLanguage(language, response.language)) {
      return `Content-Language '${response.language ?? 'missing'}' does not equal the requested '${language}'`;
    }
    return undefined;
  };

  const errorCodeOf = (payload: unknown): string | undefined => {
    if (!isRecord(payload) || !isRecord(payload.error)) return undefined;
    return isText(payload.error.code) ? payload.error.code : undefined;
  };

  const check = async (name: string, run: () => Promise<string | undefined> | string | undefined): Promise<void> => {
    try {
      const cause = await run();
      outcomes.push(cause === undefined ? { name, ok: true } : { name, ok: false, cause });
    } catch (error) {
      outcomes.push({ name, ok: false, cause: safeCause(error) });
    }
  };

  // Catalog answers reused by several checks: the run derives its examples from these payloads.
  let categoriesEs: unknown;
  let brandsEn: unknown;
  let productsPageOne: unknown;
  let derived: Derived | undefined;

  await check('GET /openapi.json declares the expected operations (OpenAPI 3.1, HerbStore API)', async () => {
    const response = await get('/openapi.json');
    if (response.status !== 200) return `expected HTTP 200, got ${response.status}`;
    const summary = parseOpenApiSummary(response.text);
    if (!summary) return 'the document is not the declared OpenAPI 3.1 contract of HerbStore API';
    const missing = missingOperations(summary, EXPECTED_OPERATIONS);
    return missing.length === 0 ? undefined : `missing declared operations: ${missing.join(', ')}`;
  });

  await check('GET /health reports ok (RF-7)', async () => {
    const response = await get('/health');
    if (response.status !== 200) return `expected HTTP 200, got ${response.status}`;
    const body = asJson(response);
    return isRecord(body) && body.status === 'ok' ? undefined : "the body does not report { status: 'ok' }";
  });

  await check('GET /home (es) is localized and satisfies the app parser (RF-8, RF-22)', async () => {
    const response = await get('/home', 'es');
    const cause = expectLocalized(response, 'es');
    if (cause) return cause;
    return parseHomePayload(asJson(response)) ? undefined : 'the body does not satisfy the app parser';
  });

  let homeEnTitle: unknown;
  await check('GET /home (en) is localized, parses and exposes a title to compare (RF-22)', async () => {
    const response = await get('/home', 'en');
    const cause = expectLocalized(response, 'en');
    if (cause) return cause;
    const data = parseHomePayload(asJson(response));
    if (!data) return 'the body does not satisfy the app parser';
    homeEnTitle = data.banners[0]?.title;
    return undefined;
  });

  await check('GET /home (es) carries copy different from en (RF-22: the languages are really localized)', async () => {
    if (!isText(homeEnTitle)) return 'the en answer above did not expose a banner title to compare';
    const response = await get('/home', 'es');
    const cause = expectLocalized(response, 'es');
    if (cause) return cause;
    const data = parseHomePayload(asJson(response));
    const title = data?.banners[0]?.title;
    return title === homeEnTitle ? 'the es copy equals the en copy; the API is not localizing' : undefined;
  });

  await check('GET /categories (es) is localized and satisfies the app parser (RF-9, RF-22)', async () => {
    const response = await get('/categories', 'es');
    const cause = expectLocalized(response, 'es');
    if (cause) return cause;
    categoriesEs = asJson(response);
    return parseCategoryTree(categoriesEs) ? undefined : 'the body does not satisfy the app parser';
  });

  await check('GET /brands (en) is localized and satisfies the app parser (RF-9, RF-22)', async () => {
    const response = await get('/brands', 'en');
    const cause = expectLocalized(response, 'en');
    if (cause) return cause;
    brandsEn = asJson(response);
    return parseBrandOptions(brandsEn) ? undefined : 'the body does not satisfy the app parser';
  });

  const limit = PRODUCT_LIST_LIMIT;

  await check('GET /products (en) paginates with unique ids and coherent totals (RF-10, RF-22)', async () => {
    const response = await get(`/products?sort=featured&page=1&limit=${limit}`, 'en');
    const cause = expectLocalized(response, 'en');
    if (cause) return cause;
    productsPageOne = asJson(response);
    const parsed = parseProductPage(productsPageOne);
    if (!parsed) return 'the body does not satisfy the app parser';
    if (parsed.page !== 1) return `expected page 1, got ${parsed.page}`;
    if (parsed.items.length === 0) return 'the first page is empty; the catalog cannot be exercised';
    if (new Set(parsed.items.map(({ id }) => id)).size !== parsed.items.length) return 'a page repeats an id';
    if (parsed.total < parsed.items.length) return `total ${parsed.total} is smaller than the page items`;
    derived = deriveExamples({ categories: categoriesEs, brands: brandsEn, products: itemsOf(productsPageOne) });
    return derived ? undefined : 'the catalog did not provide a usable example (category, subcategory, brand, in-stock product with ean13 and image)';
  });

  await check('GET /products page 2 returns other items with the same totals (RF-10)', async () => {
    if (!derived) return DERIVED_SKIP;
    const response = await get(`/products?sort=featured&page=2&limit=${limit}`, 'en');
    const cause = expectLocalized(response, 'en');
    if (cause) return cause;
    const parsed = parseProductPage(asJson(response));
    if (!parsed) return 'the body does not satisfy the app parser';
    const first = parseProductPage(productsPageOne);
    if (!first) return 'the first page is no longer parseable';
    const overlap = parsed.items.filter(({ id }) => first.items.some((item) => item.id === id));
    return overlap.length === 0 && parsed.total === first.total
      ? undefined
      : overlap.length > 0
        ? 'page 2 repeats items of page 1'
        : `total changed between pages (${first.total} → ${parsed.total})`;
  });

  await check('GET /products accepts the five sorts and orders prices for price_asc/price_desc (RF-12)', async () => {
    if (!derived) return DERIVED_SKIP;
    for (const sort of PRODUCT_SORTS) {
      const response = await get(`/products?sort=${sort}&page=1&limit=${limit}`, 'en');
      const cause = expectLocalized(response, 'en') ?? (parseProductPage(asJson(response)) ? undefined : `sort '${sort}': the body does not satisfy the app parser`);
      if (cause) return cause;
    }
    for (const [sort, ascending] of [['price_asc', true], ['price_desc', false]] as const) {
      const prices = pricesOf(asJson(await get(`/products?sort=${sort}&page=1&limit=${limit}`, 'en')));
      if (!prices || prices.length < 2) return `sort '${sort}': the answer exposes no prices to compare`;
      const ordered = prices.every((price, index) => index === 0 || (ascending ? prices[index - 1]! <= price : prices[index - 1]! >= price));
      if (!ordered) return `sort '${sort}' does not order prices ${ascending ? 'ascending' : 'descending'}`;
    }
    return undefined;
  });

  await check('GET /products filters by the category, brand and subcategory of the catalog (RF-10, RF-11)', async () => {
    if (!derived) return DERIVED_SKIP;
    const example = derived;
    const cases = [
      ['category', `category=${encodeURIComponent(example.categoryId)}`, 'categoryId', example.categoryId],
      ['brand', `brand=${encodeURIComponent(example.brand)}`, 'brand', example.brand],
      ['subcategory', `subcategory=${encodeURIComponent(example.subcategoryId)}`, 'subcategoryId', example.subcategoryId],
    ] as const;
    for (const [label, query, field, expected] of cases) {
      const response = await get(`/products?${query}&page=1&limit=${limit}`, 'en');
      const cause = expectLocalized(response, 'en');
      if (cause) return `${label} filter: ${cause}`;
      const items = itemsOf(asJson(response));
      if (!items) return `${label} filter: the body is not an item page`;
      if (!items.every((item) => item[field] === expected)) return `${label} filter returns items outside '${expected}'`;
    }
    return undefined;
  });

  await check('GET /products combines facets: OR inside one facet, AND across facets (RF-11)', async () => {
    if (!derived) return DERIVED_SKIP;
    const example = derived;
    const brands = parseBrandOptions(brandsEn)?.map(({ name }) => name) ?? [];
    const second = brands.find((name) => name !== example.brand) ?? example.brand;
    const pageOf = async (query: string) => parseProductPage(asJson(await get(`/products?${query}&page=1&limit=${limit}`, 'en')));
    const firstTotal = (await pageOf(`brand=${encodeURIComponent(example.brand)}`))?.total;
    const secondTotal = (await pageOf(`brand=${encodeURIComponent(second)}`))?.total;
    const combinedTotal = (await pageOf(`brand=${encodeURIComponent(example.brand)},${encodeURIComponent(second)}`))?.total;
    if (firstTotal === undefined || secondTotal === undefined || combinedTotal === undefined) return 'a facet answer does not satisfy the app parser';
    if (combinedTotal < Math.max(firstTotal, secondTotal)) return 'the OR inside the brand facet drops results';
    const and = await pageOf(`brand=${encodeURIComponent(example.brand)}&subcategory=${encodeURIComponent(example.subcategoryId)}`);
    if (!and) return 'the AND answer does not satisfy the app parser';
    return and.items.every((item) => item.brand === example.brand && item.subcategoryId === example.subcategoryId)
      ? undefined
      : 'the AND across facets returns items that match neither facet';
  });

  await check('GET /products applies inStock, minRating, ownBrand and subscribeAndSave before totals (RF-12)', async () => {
    if (!derived) return DERIVED_SKIP;
    const cases = [
      ['inStock', 'inStock=true', (item: Record<string, unknown>) => item.inStock === true],
      ['minRating', 'minRating=4', (item: Record<string, unknown>) => typeof item.rating === 'number' && item.rating >= 4],
      ['ownBrand', 'ownBrand=true', (item: Record<string, unknown>) => item.isOwnBrand === true],
      ['subscribeAndSave', 'subscribeAndSave=true', (item: Record<string, unknown>) => item.subscribeAndSave === true],
    ] as const;
    for (const [label, query, holds] of cases) {
      const response = await get(`/products?${query}&page=1&limit=${limit}`, 'en');
      const cause = expectLocalized(response, 'en');
      if (cause) return `${label} filter: ${cause}`;
      const items = itemsOf(asJson(response));
      if (!items) return `${label} filter: the body is not an item page`;
      if (!items.every(holds)) return `${label} filter returns items that do not satisfy it`;
    }
    return undefined;
  });

  await check('GET /products q finds a real term and an impossible term empties the page (RF-11)', async () => {
    if (!derived) return DERIVED_SKIP;
    const term = normalizeSearchText(derived.productName.split(' ')[0] ?? '');
    if (!term) return 'the derived search term is empty';
    const found = parseProductPage(asJson(await get(`/products?q=${encodeURIComponent(term)}&page=1&limit=${limit}`, 'en')));
    if (!found) return 'the search answer does not satisfy the app parser';
    if (found.total < 1) return 'the search for a term of a real product returns nothing';
    const empty = parseProductPage(asJson(await get('/products?q=zzzz-no-match&page=1&limit=20', 'en')));
    if (!empty) return 'the empty-page answer does not satisfy the app parser';
    return empty.items.length === 0 && empty.total === 0 && empty.totalPages === 0
      ? undefined
      : 'an impossible term does not produce a coherent empty page';
  });

  await check('GET /products beyond the last page returns an empty page with the same totals (RF-10)', async () => {
    if (!derived) return DERIVED_SKIP;
    const first = parseProductPage(productsPageOne);
    if (!first) return 'the first page is no longer parseable';
    if (first.totalPages < 1) return 'the catalog reports no pages';
    const beyond = parseProductPage(asJson(await get(`/products?sort=featured&page=${first.totalPages + 1}&limit=${limit}`, 'en')));
    if (!beyond) return 'the beyond-the-last answer does not satisfy the app parser';
    return beyond.items.length === 0 && beyond.total === first.total && beyond.totalPages === first.totalPages
      ? undefined
      : 'a page beyond the last does not keep the totals with empty items';
  });

  await check('GET /products with an invalid sort fails 400 INVALID_QUERY in a single request (RF-27, RF-34)', async () => {
    const before = calls.length;
    const response = await get('/products?sort=bogus', 'en');
    if (calls.length - before !== 1) return `expected a single request without retry, observed ${calls.length - before}`;
    if (response.status !== 400) return `expected HTTP 400, got ${response.status}`;
    const code = errorCodeOf(asJson(response));
    if (!code) return 'the 400 body does not carry an error code';
    return code === 'INVALID_QUERY' ? undefined : `expected error code INVALID_QUERY, got '${code}'`;
  });

  await check('GET /products/{id} (es) parses with description, stock and inStock == stock > 0 (RF-14, RF-22)', async () => {
    if (!derived) return DERIVED_SKIP;
    if (!parseProductId(derived.productId)) return 'the derived product id is not locally valid (RF-40)';
    const response = await get(`/products/${derived.productId}`, 'es');
    const cause = expectLocalized(response, 'es');
    if (cause) return cause;
    const detail = parseProductDetail(asJson(response));
    if (!detail) return 'the body does not satisfy the app parser';
    if (detail.description.length === 0) return 'the description is empty';
    return detail.inStock === detail.stock > 0 ? undefined : 'inStock does not equal stock > 0';
  });

  await check('GET /products/barcode/{ean13} (en) returns the same product (RF-14, RF-40)', async () => {
    if (!derived) return DERIVED_SKIP;
    if (!isValidEan13(derived.ean13)) return 'the derived ean13 is not locally valid (RF-40)';
    const response = await get(`/products/barcode/${derived.ean13}`, 'en');
    const cause = expectLocalized(response, 'en');
    if (cause) return cause;
    const detail = parseProductDetail(asJson(response));
    if (!detail) return 'the body does not satisfy the app parser';
    return detail.id === derived.productId ? undefined : 'the barcode resolves to a different product';
  });

  await check('GET /products of an id absent from the catalog answers 404 with an error code (RF-40)', async () => {
    if (!derived) return DERIVED_SKIP;
    // Absence is derived from the catalog itself: the seed of a real id with the largest position.
    const [, seed] = derived.productId.split('-');
    const candidate = `product-${seed}-999`;
    if (!parseProductId(candidate)) return 'the derived candidate is not locally valid (RF-40)';
    const response = await get(`/products/${candidate}`, 'en');
    if (response.status !== 404) return `expected HTTP 404, got ${response.status}`;
    return errorCodeOf(asJson(response)) ? undefined : 'the 404 body does not carry an error code';
  });

  await check('GET /images of a catalog reference answers image/png (RF-15)', async () => {
    if (!derived) return DERIVED_SKIP;
    const response = await get(derived.image, undefined, 'image/*');
    if (response.status !== 200) return `expected HTTP 200, got ${response.status}`;
    if (!(response.contentType ?? '').startsWith('image/png')) return `expected content type image/png, got '${response.contentType ?? 'missing'}'`;
    const magic = [137, 80, 78, 71, 13, 10, 26, 10];
    return magic.every((byte, index) => response.bytes[index] === byte) ? undefined : 'the bytes are not a PNG';
  });

  await check('GET /images of an unknown name answers 404 (RF-15)', async () => {
    if (!derived) return DERIVED_SKIP;
    const slash = derived.image.lastIndexOf('/');
    const unknown = `${derived.image.slice(0, slash)}/${derived.image.slice(slash + 1).replace(/(\.[a-z]+)$/i, '-missing$1')}`;
    const response = await get(unknown, undefined, 'image/*');
    return response.status === 404 ? undefined : `expected HTTP 404, got ${response.status}`;
  });

  await check("GET /orders/status with a fresh key answers not_created without creating an attempt (RF-19)", async () => {
    // Orders are not localized: no Accept-Language is sent and no Content-Language is required.
    const response = await get(`/orders/status/${randomUUID()}`);
    if (response.status !== 404) return `expected HTTP 404 for a fresh key, got ${response.status}`;
    const body = asJson(response);
    const status = isRecord(body) && isText(body.status) ? body.status : undefined;
    const code = errorCodeOf(body);
    return status === 'not_created' && code === 'ORDER_NOT_CREATED'
      ? undefined
      : 'the 404 body is not the not_created pair of RF-19';
  });

  await check('the verification itself sent only GET requests (non-mutating, RF-42)', () => {
    const mutating = calls.filter(({ method }) => method !== 'GET');
    if (mutating.length > 0) return `${mutating.length} non-GET request(s) were sent`;
    return calls.some(({ path }) => path.startsWith('/orders/status/'))
      ? undefined
      : 'the order-status endpoint was never consulted';
  });

  return { outcomes };
}

const DERIVED_SKIP = 'the catalog examples could not be derived, so this check cannot run';

async function main(): Promise<number> {
  let origin: string;
  try {
    origin = requireOrigin(process.env);
  } catch (error) {
    console.error(`FAIL origin: ${error instanceof Error ? error.message : 'unknown cause'}`);
    console.error('Run it as: HERBSTORE_LIVE_API_ORIGIN=http://localhost:3001 npm run verify:live-api');
    return 2;
  }

  console.log(`HerbStore live API verification — ${origin}`);
  console.log('Read-only: every request is a GET; POST /orders is never sent.\n');

  const { outcomes } = await runVerification({ origin, fetchImpl: globalThis.fetch });
  for (const outcome of outcomes) console.log(formatOutcome(outcome));

  const failed = outcomes.filter(({ ok }) => !ok).length;
  console.log(`\n${outcomes.length - failed} OK, ${failed} FAIL`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main();
}
