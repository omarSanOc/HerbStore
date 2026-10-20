/// <reference types="node" />
// Unit tests of the live verifier (RF-41): every function runs against injected data or an
// injected `fetch`, so this suite never touches the network and stays inside `npm test`.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveExamples,
  describePath,
  formatOutcome,
  isCoherentLanguage,
  missingOperations,
  parseOpenApiSummary,
  requireOrigin,
  runVerification,
  type FetchLike,
} from './verify-live-api.ts';

// ---------- requireOrigin: the smoke only runs against an explicit origin ----------

test('requireOrigin returns a normalized origin for an http(s) URL without credentials', () => {
  assert.equal(requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'http://localhost:3001/' }), 'http://localhost:3001');
  assert.equal(requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'https://api.example.test' }), 'https://api.example.test');
});

test('requireOrigin fails with the variable name when the origin is missing or empty', () => {
  assert.throws(() => requireOrigin({}), /HERBSTORE_LIVE_API_ORIGIN/);
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: '' }), /HERBSTORE_LIVE_API_ORIGIN/);
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: '   ' }), /HERBSTORE_LIVE_API_ORIGIN/);
});

test('requireOrigin rejects malformed URLs, non-http schemes and embedded credentials', () => {
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'not a url' }), /URL/);
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'localhost:3001' }), /http/);
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'ftp://api.example.test' }), /http/);
  assert.throws(() => requireOrigin({ HERBSTORE_LIVE_API_ORIGIN: 'http://user:pass@api.example.test' }), /credential/);
});

// ---------- describePath: nothing sensitive reaches the output ----------

test('describePath cuts the query string, which can carry a search term', () => {
  assert.equal(describePath('/products?page=2&brand=secret%20term'), '/products');
  assert.equal(describePath('/products'), '/products');
});

test('describePath masks an order-status key the way checkout does', () => {
  assert.equal(describePath('/orders/status/abcdef-ghijkl-mnop'), '/orders/status/…mnop');
});

// ---------- OpenAPI: operations are identified from the document, not from memory ----------

const OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'HerbStore API', version: '0.1.0' },
  paths: {
    '/health': { get: {} },
    '/home': { get: {} },
    '/categories': { get: {} },
    '/brands': { get: {} },
    '/products': { get: {} },
    '/products/barcode/{code}': { get: {} },
    '/products/{product_id}': { get: {} },
    '/images/{kind}/{name}': { get: {} },
    '/orders': { post: {} },
    '/orders/status/{key}': { get: {} },
  },
};

test('parseOpenApiSummary reads version, title and every declared operation', () => {
  const summary = parseOpenApiSummary(JSON.stringify(OPENAPI));
  assert.ok(summary);
  assert.equal(summary.openapi, '3.1.0');
  assert.equal(summary.title, 'HerbStore API');
  assert.equal(summary.version, '0.1.0');
  assert.deepEqual(summary.operations.sort(), [
    'GET /brands',
    'GET /categories',
    'GET /health',
    'GET /home',
    'GET /images/{kind}/{name}',
    'GET /orders/status/{key}',
    'GET /products',
    'GET /products/barcode/{code}',
    'GET /products/{product_id}',
    'POST /orders',
  ]);
});

test('parseOpenApiSummary rejects a different document shape', () => {
  assert.equal(parseOpenApiSummary('not json'), undefined);
  assert.equal(parseOpenApiSummary(JSON.stringify({ openapi: '3.0.1', info: OPENAPI.info, paths: {} })), undefined);
  assert.equal(
    parseOpenApiSummary(JSON.stringify({ openapi: '3.1.0', info: { title: 'Other API', version: '1.0.0' }, paths: {} })),
    undefined,
  );
  assert.equal(parseOpenApiSummary(JSON.stringify({ openapi: '3.1.0', info: OPENAPI.info })), undefined);
});

test('missingOperations lists only what the document does not declare', () => {
  const summary = parseOpenApiSummary(JSON.stringify(OPENAPI));
  assert.ok(summary);
  assert.deepEqual(missingOperations(summary, ['GET /health', 'POST /orders']), []);
  assert.deepEqual(missingOperations(summary, ['GET /health', 'GET /coupons', 'POST /orders']), ['GET /coupons']);
});

// ---------- language coherence (RF-22, RF-23): exact match, nothing else ----------

test('isCoherentLanguage accepts only the exact requested code', () => {
  assert.equal(isCoherentLanguage('es', 'es'), true);
  assert.equal(isCoherentLanguage('en', 'en'), true);
  assert.equal(isCoherentLanguage('es', 'en'), false);
  assert.equal(isCoherentLanguage('es', 'ES'), false);
  assert.equal(isCoherentLanguage('es', null), false);
  assert.equal(isCoherentLanguage('es', ''), false);
});

// ---------- example derivation: the smoke adapts to the catalog, never assumes it ----------

const PRODUCT = {
  id: 'product-261009-001',
  brand: 'Solstice Grove',
  name: 'Magnesium Complex',
  categoryId: 'minerals',
  subcategoryId: 'zinc',
  ean13: '2002610090011',
  images: ['/images/products/product-001-front.png'],
  price: 12.99,
  currency: 'USD',
  rating: 4.2,
  reviewCount: 10,
  soldLast30Days: 5,
  badges: [],
  inStock: true,
  isOwnBrand: false,
  subscribeAndSave: false,
};
const SECOND = { ...PRODUCT, id: 'product-261009-002', ean13: '2002610090028', inStock: false, images: [] };

test('deriveExamples takes every value from the catalog it is given', () => {
  const derived = deriveExamples({
    categories: [{ id: 'cats', name: 'Cat', productCount: 1, subcategories: [{ id: 'dogs', name: 'Sub', productCount: 1 }] }],
    brands: [{ name: 'Acme', productCount: 1 }],
    products: [SECOND, PRODUCT],
  });

  assert.ok(derived);
  assert.equal(derived.categoryId, 'cats');
  assert.equal(derived.subcategoryId, 'dogs');
  assert.equal(derived.brand, 'Acme');
  assert.equal(derived.productId, PRODUCT.id);
  assert.equal(derived.ean13, PRODUCT.ean13);
  assert.equal(derived.image, PRODUCT.images[0]);
});

test('deriveExamples prefers an in-stock product and skips unusable ones', () => {
  const derived = deriveExamples({
    categories: [{ id: 'c1', name: 'C', productCount: 1, subcategories: [{ id: 's1', name: 'S', productCount: 1 }] }],
    brands: [{ name: 'Acme', productCount: 1 }],
    products: [SECOND, PRODUCT],
  });
  assert.ok(derived);
  assert.equal(derived.productId, PRODUCT.id, 'the in-stock product with images and ean13 wins');
});

test('deriveExamples gives up instead of inventing data', () => {
  assert.equal(deriveExamples({ categories: [], brands: [], products: [] }), undefined);
  assert.equal(
    deriveExamples({ categories: [], brands: [], products: [{ ...PRODUCT, ean13: undefined, images: [] }] }),
    undefined,
  );
  assert.equal(deriveExamples({ categories: [], brands: [], products: [PRODUCT] }), undefined, 'a missing facet is not filled with a guess');
});

// ---------- output formatting ----------

test('formatOutcome renders OK and FAIL with the cause', () => {
  assert.equal(formatOutcome({ name: 'GET /health reports ok', ok: true }), 'OK   GET /health reports ok');
  assert.equal(
    formatOutcome({ name: 'GET /home (es)', ok: false, cause: "Content-Language 'en' ≠ requested 'es'" }),
    "FAIL GET /home (es): Content-Language 'en' ≠ requested 'es'",
  );
});

// ---------- runVerification: the whole flow against an injected fetch ----------

function png(bytes: number[], contentType = 'image/png'): Response {
  return new Response(new Uint8Array(bytes), { status: 200, headers: { 'content-type': contentType } });
}
function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];

const DETAIL = { ...PRODUCT, servingInfo: { size: '2 capsules', servingsPerContainer: 30 }, description: 'BODY-SENTINEL Fictional description.', stock: 7 };
const CATALOG = [PRODUCT, { ...SECOND, id: 'product-261009-003', ean13: '2002610090035', price: 30, rating: 5, brand: 'Acme', subcategoryId: 'dogs', images: ['/images/products/product-003-front.png'] }];

/** A small in-test API speaking the contract: language header, paging, filters and errors. */
function fakeApi(): { fetch: FetchLike; calls: { method: string; url: string; acceptLanguage: string | null }[] } {
  const calls: { method: string; url: string; acceptLanguage: string | null }[] = [];
  const fetch: FetchLike = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    const requestHeaders = new Headers(init?.headers);
    calls.push({ method, url: String(url), acceptLanguage: requestHeaders.get('accept-language') });
    const lang = requestHeaders.get('accept-language') ?? 'en';
    const localized = (body: unknown, status = 200) => json(body, status, { 'content-language': lang });

    if (url.pathname === '/openapi.json') return json(OPENAPI);
    if (url.pathname === '/health') return json({ status: 'ok' });
    if (url.pathname === '/home') {
      return localized({
        banners: [{ id: 'b1', title: lang === 'es' ? 'Título' : 'Title', subtitle: 'Sub', imageUrl: '/images/banners/b1.png', categoryId: 'minerals' }],
        categories: [{ id: 'minerals', name: 'Minerales', productCount: CATALOG.length, imageUrl: '/images/categories/minerals.png' }],
        sections: [{ id: 'best_sellers', title: 'Top', items: CATALOG }],
      });
    }
    if (url.pathname === '/categories') {
      return localized([{ id: 'minerals', name: 'Minerales', productCount: CATALOG.length, subcategories: [{ id: 'zinc', name: 'Zinc', productCount: 1 }] }]);
    }
    if (url.pathname === '/brands') {
      return localized([
        { name: 'Acme', productCount: 1 },
        { name: 'Solstice Grove', productCount: 1 },
      ]);
    }
    const barcode = /^\/products\/barcode\/(.+)$/.exec(url.pathname);
    if (barcode) {
      const found = CATALOG.find(({ ean13 }) => ean13 === barcode[1]);
      return found ? localized({ ...DETAIL, ...found }) : json({ error: { code: 'PRODUCT_NOT_FOUND' } }, 404);
    }
    const detail = /^\/products\/(product-[\d-]+)$/.exec(url.pathname);
    if (detail) {
      const found = CATALOG.find(({ id }) => id === detail[1]);
      return found ? localized({ ...DETAIL, ...found }) : json({ error: { code: 'PRODUCT_NOT_FOUND' } }, 404);
    }
    if (url.pathname === '/images/products/product-001-front.png') return png(PNG_MAGIC);
    if (url.pathname.startsWith('/images/')) return json({ error: { code: 'NOT_FOUND' } }, 404);
    if (url.pathname.startsWith('/orders/status/')) {
      return json({ status: 'not_created', error: { code: 'ORDER_NOT_CREATED' } }, 404);
    }
    if (url.pathname !== '/products') return json({ error: { code: 'NOT_FOUND' } }, 404);

    if (url.searchParams.get('sort') === 'bogus') return json({ error: { code: 'INVALID_QUERY' } }, 400);
    let items = [...CATALOG];
    const brand = url.searchParams.get('brand');
    if (brand) {
      const wanted = brand.split(',').map((value) => value.toLowerCase());
      items = items.filter(({ brand: candidate }) => wanted.includes(candidate.toLowerCase()));
    }
    const subcategory = url.searchParams.get('subcategory');
    if (subcategory) {
      const wanted = subcategory.split(',').map((value) => value.toLowerCase());
      items = items.filter(({ subcategoryId }) => wanted.includes(subcategoryId.toLowerCase()));
    }
    const category = url.searchParams.get('category');
    if (category) items = items.filter(({ categoryId }) => categoryId === category);
    if (url.searchParams.get('inStock') === 'true') items = items.filter(({ inStock }) => inStock);
    if (url.searchParams.get('ownBrand') === 'true') items = items.filter(({ isOwnBrand }) => isOwnBrand);
    if (url.searchParams.get('subscribeAndSave') === 'true') items = items.filter(({ subscribeAndSave }) => subscribeAndSave);
    const minRating = url.searchParams.get('minRating');
    if (minRating) items = items.filter(({ rating }) => rating >= Number(minRating));
    const q = url.searchParams.get('q');
    if (q) {
      const norm = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      items = items.filter(({ name, brand: candidate }) => norm(`${name} ${candidate}`).includes(norm(q)));
    }
    const sort = url.searchParams.get('sort');
    if (sort === 'price_asc') items.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') items.sort((a, b) => b.price - a.price);
    const total = items.length;
    const limit = Number(url.searchParams.get('limit') ?? 20);
    const page = Number(url.searchParams.get('page') ?? 1);
    const start = (page - 1) * limit;
    return localized({ items: items.slice(start, start + limit), page, totalPages: Math.ceil(total / limit), total });
  };
  return { fetch, calls };
}

test('runVerification passes every check against a contract-shaped API, sending only GETs', async () => {
  const { fetch, calls } = fakeApi();
  const { outcomes } = await runVerification({ origin: 'http://api.test', fetchImpl: fetch });

  const failed = outcomes.filter(({ ok }) => !ok);
  assert.deepEqual(failed.map(({ name, cause }) => `${name}: ${cause}`), []);
  assert.equal(outcomes.length >= 15, true, 'the run covers openapi, health, home, facets, products, detail, barcode, images, orders and the no-POST rule');

  assert.equal(calls.every(({ method }) => method === 'GET'), true, 'the verifier is non-mutating');
  assert.equal(calls.some(({ url }) => url.includes('/orders/status/')), true, 'order status is consulted with a fresh key');
  assert.equal(calls.some(({ method, url }) => method === 'POST' && url.includes('/orders')), false);
  const orderStatusCall = calls.find(({ url }) => url.includes('/orders/status/'));
  assert.ok(orderStatusCall);
  assert.equal(orderStatusCall.acceptLanguage, null, 'order status does not send Accept-Language');

  const printed = JSON.stringify(outcomes);
  assert.equal(printed.includes('BODY-SENTINEL'), false);
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/.test(printed), false, 'a fresh idempotency key never reaches the output');
});

test('runVerification asks each route exactly once (a 4xx is not retried)', async () => {
  const { fetch, calls } = fakeApi();
  await runVerification({ origin: 'http://api.test', fetchImpl: fetch });

  const invalidSort = calls.filter(({ url }) => url.includes('sort=bogus'));
  assert.equal(invalidSort.length, 1, 'the 400 is observed once, without automatic retry');
});

test('runVerification fails with the language cause when Content-Language does not match', async () => {
  const { fetch } = fakeApi();
  const stubborn: FetchLike = async (input, init) => {
    const response = await fetch(input, init);
    if (String(input).includes('/home') && new Headers(init?.headers).get('accept-language') === 'es') {
      return json(JSON.parse(await response.text()), response.status, { 'content-language': 'en' });
    }
    return response;
  };
  const { outcomes } = await runVerification({ origin: 'http://api.test', fetchImpl: stubborn });

  const home = outcomes.find(({ name }) => name.includes('/home') && name.includes('es'));
  assert.ok(home);
  assert.equal(home.ok, false);
  assert.match(home.cause ?? '', /Content-Language/);
});

test('runVerification reports a transport failure without leaking the thrown message', async () => {
  const down: FetchLike = () => Promise.reject(new Error('TOP-SECRET-DETAIL'));
  const { outcomes } = await runVerification({ origin: 'http://api.test', fetchImpl: down });

  // The no-POST audit only reads the request log, so it stays green; every live check must fail.
  const live = outcomes.filter(({ name }) => !name.includes('sent only GET'));
  assert.equal(live.every(({ ok }) => !ok), true);
  assert.equal(JSON.stringify(outcomes).includes('TOP-SECRET-DETAIL'), false);
  assert.match(JSON.stringify(live), /transport level/);
});
