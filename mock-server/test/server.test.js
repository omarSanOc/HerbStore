import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import {
  CATALOG_SEED,
  generateCatalog,
} from '../src/catalog/generate-catalog.js';
import { queryProducts } from '../src/catalog/query-products.js';
import { createApp } from '../src/server.js';

const catalog = generateCatalog(CATALOG_SEED);

async function requestJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, body: await response.json() };
}

async function postJson(baseUrl, path, { key, body }) {
  const headers = { 'Content-Type': 'application/json' };
  if (key !== undefined) {
    headers['Idempotency-Key'] = key;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

describe('catalog HTTP contracts', () => {
  let baseUrl;
  let server;

  before(async () => {
    server = createApp({ latencyMs: 0 }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, 'object');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('reports server health', async () => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  it('derives populated home banners, categories, and approved sections from the catalog', async () => {
    const { response, body } = await requestJson(baseUrl, '/home');

    assert.equal(response.status, 200);
    assert.ok(body.banners.length > 0);
    assert.ok(body.categories.length > 0);
    assert.equal(
      body.categories.reduce(
        (sum, category) => sum + category.productCount,
        0,
      ),
      300,
    );
    assert.deepEqual(
      body.sections.map(({ id }) => id),
      ['best_sellers', 'new', 'offers'],
    );
    assert.ok(body.sections.every(({ items }) => items.length > 0));
    assert.ok(
      body.sections
        .flatMap(({ items }) => items)
        .every((item) => catalog.some(({ id }) => id === item.id)),
    );
    const [bestSellers, newProducts, offers] = body.sections;
    assert.ok(
      bestSellers.items.every(
        (product, index) =>
          index === 0 ||
          bestSellers.items[index - 1].soldLast30Days >=
            product.soldLast30Days,
      ),
    );
    assert.ok(newProducts.items.every(({ badges }) => badges.includes('NEW')));
    assert.ok(
      offers.items.every(
        ({ couponText, listPrice }) =>
          couponText !== undefined || listPrice !== undefined,
      ),
    );
  });

  it('returns the category tree and brand counts from the same 300 products', async () => {
    const categoriesResult = await requestJson(baseUrl, '/categories');
    const brandsResult = await requestJson(baseUrl, '/brands');

    assert.equal(categoriesResult.response.status, 200);
    assert.equal(brandsResult.response.status, 200);
    assert.equal(
      categoriesResult.body.reduce((sum, category) => sum + category.productCount, 0),
      300,
    );
    for (const category of categoriesResult.body) {
      assert.equal(
        category.subcategories.reduce(
          (sum, subcategory) => sum + subcategory.productCount,
          0,
        ),
        category.productCount,
      );
    }
    assert.equal(
      brandsResult.body.reduce((sum, brand) => sum + brand.productCount, 0),
      300,
    );
  });

  it('adapts product filtering and pagination to the approved page contract', async () => {
    const { response, body } = await requestJson(
      baseUrl,
      '/products?category=vitamins&minRating=4&inStock=true&page=1&limit=5',
    );

    const expected = catalog.filter(
      (product) =>
        product.categoryId === 'vitamins' &&
        product.rating >= 4 &&
        product.inStock,
    );
    assert.equal(response.status, 200);
    assert.equal(body.items.length, Math.min(5, expected.length));
    assert.equal(body.page, 1);
    assert.equal(body.total, expected.length);
    assert.equal(body.totalPages, Math.ceil(expected.length / 5));
  });

  it('adapts CSV facets, normalized search, and sorting without route-level rules', async () => {
    const first = catalog[0];
    const secondBrand = catalog.find(({ brand }) => brand !== first.brand).brand;
    const rawQuery = {
      brand: `${first.brand},${secondBrand}`,
      subcategory: first.subcategoryId,
      q: '  DAILY   WELLNESS ',
      sort: 'best_selling',
      page: '1',
      limit: '10',
    };
    const search = new URLSearchParams(rawQuery);
    const { response, body } = await requestJson(
      baseUrl,
      `/products?${search.toString()}`,
    );

    assert.equal(response.status, 200);
    assert.deepEqual(body, queryProducts(catalog, rawQuery));
  });

  it('returns products by id and barcode without allowing :id to capture barcode', async () => {
    const product = catalog[42];
    const byId = await requestJson(baseUrl, `/products/${product.id}`);
    const byBarcode = await requestJson(
      baseUrl,
      `/products/barcode/${product.ean13}`,
    );

    // The detail is the catalog product plus the live `stock` (see 'product stock on the detail
    // endpoints'); `inStock` is derived from it, and a fresh server has 99 units of an available one.
    const detail = { ...product, stock: 99, inStock: true };
    assert.equal(byId.response.status, 200);
    assert.deepEqual(byId.body, detail);
    assert.equal(byBarcode.response.status, 200);
    assert.deepEqual(byBarcode.body, detail);
  });

  it('distinguishes invalid, valid missing, and existing product resources', async () => {
    const missingId = await requestJson(baseUrl, '/products/product-does-not-exist');
    const malformedBarcode = await requestJson(baseUrl, '/products/barcode/123');
    const badChecksum = await requestJson(baseUrl, '/products/barcode/2006100909998');
    const missingBarcode = await requestJson(baseUrl, '/products/barcode/9999999999994');

    assert.equal(missingId.response.status, 404);
    assert.equal(malformedBarcode.response.status, 400);
    assert.equal(badChecksum.response.status, 400);
    assert.equal(missingBarcode.response.status, 404);
    assert.equal(missingId.body.error.code, 'PRODUCT_NOT_FOUND');
    assert.equal(malformedBarcode.body.error.code, 'INVALID_BARCODE');
    assert.equal(missingBarcode.body.error.code, 'PRODUCT_NOT_FOUND');
  });

  it('returns a consistent safe error for invalid query parameters', async () => {
    const invalidPaths = [
      '/products?page=0',
      '/products?limit=51',
      '/products?brand=Known,,Unknown',
      '/products?minRating=NaN',
      '/products?inStock=1',
      '/products?sort=popular',
      '/products?fail=yes',
    ];

    for (const path of invalidPaths) {
      const { response, body } = await requestJson(baseUrl, path);
      assert.equal(response.status, 400, path);
      assert.deepEqual(Object.keys(body), ['error']);
      assert.equal(body.error.code, 'INVALID_QUERY');
      assert.equal(typeof body.error.message, 'string');
      assert.equal('stack' in body.error, false);
    }
  });

  it('returns 200 empty data for valid unknown facets and later pages', async () => {
    const unknown = await requestJson(
      baseUrl,
      '/products?brand=Unknown%20Fictional%20Brand',
    );
    const laterPage = await requestJson(baseUrl, '/products?page=99&limit=10');

    assert.equal(unknown.response.status, 200);
    assert.deepEqual(unknown.body, {
      items: [],
      page: 1,
      totalPages: 0,
      total: 0,
    });
    assert.equal(laterPage.response.status, 200);
    assert.equal(laterPage.body.items.length, 0);
    assert.equal(laterPage.body.page, 99);
    assert.equal(laterPage.body.totalPages, 30);
    assert.equal(laterPage.body.total, 300);
  });
});

describe('product stock on the detail endpoints', () => {
  const HOUR_MS = 60 * 60 * 1000;
  const available = catalog[42];
  const soldOut = catalog[0];
  const address = {
    fullName: 'Test Customer',
    phone: '5512345678',
    postalCode: '03100',
    state: 'CDMX',
    city: 'Benito Juárez',
    street: 'Fictional Avenue',
    exteriorNumber: '42',
  };
  let baseUrl;
  let server;
  let now;

  function order(productId, quantity) {
    return {
      items: [{ productId, quantity }],
      shippingAddress: address,
      currency: 'MXN',
    };
  }

  async function stockOf(product) {
    const byId = await requestJson(baseUrl, `/products/${product.id}`);
    const byBarcode = await requestJson(baseUrl, `/products/barcode/${product.ean13}`);

    assert.equal(byId.response.status, 200);
    assert.equal(byBarcode.response.status, 200);
    assert.equal(byBarcode.body.stock, byId.body.stock);
    assert.equal(byBarcode.body.inStock, byId.body.inStock);

    return { stock: byId.body.stock, inStock: byId.body.inStock };
  }

  before(async () => {
    now = Date.parse('2026-10-10T12:00:00.000Z');
    server = createApp({
      latencyMs: 0,
      orderClock: () => now,
      // A pending that outlives the 24 h window: it can expire and give its units back.
      orderProcessingMs: 30 * HOUR_MS,
    }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('starts with 99 units of an available product and 0 of the fixed sold-out one', async () => {
    assert.equal(soldOut.id, 'product-261009-001');
    assert.deepEqual(await stockOf(available), { stock: 99, inStock: true });
    assert.deepEqual(await stockOf(soldOut), { stock: 0, inStock: false });
  });

  it('drops with a pending order and keeps `inStock` equal to `stock > 0`', async () => {
    const first = await postJson(baseUrl, '/orders', {
      key: 'stock-first',
      body: order(available.id, 2),
    });
    assert.equal(first.response.status, 202);
    assert.deepEqual(await stockOf(available), { stock: 97, inStock: true });

    const rest = await postJson(baseUrl, '/orders', {
      key: 'stock-rest',
      body: order(available.id, 97),
    });
    assert.equal(rest.response.status, 202);
    assert.deepEqual(await stockOf(available), { stock: 0, inStock: false });
  });

  it('leaves lists, search and Home exactly as before, whatever the live stock is', async () => {
    // `available` is now sold out in this session, and every catalog route still shows the catalog.
    const list = await requestJson(
      baseUrl,
      `/products?${new URLSearchParams({ q: available.name, limit: '50' })}`,
    );
    const listed = list.body.items.find(({ id }) => id === available.id);
    assert.ok(listed, 'the product is still in the list');
    assert.equal(listed.inStock, true);
    assert.deepEqual(list.body, queryProducts(catalog, { q: available.name, limit: '50' }));

    const everyItem = await requestJson(baseUrl, '/products?limit=50');
    assert.ok(everyItem.body.items.every((item) => !('stock' in item)));
    const home = await requestJson(baseUrl, '/home');
    assert.equal(JSON.stringify(home.body).includes('"stock"'), false);
  });

  it('returns the units when the pending expires', async () => {
    now += 24 * HOUR_MS;

    assert.deepEqual(await stockOf(available), { stock: 99, inStock: true });
  });

  it('does not change the stock of a rejected order or of a sold-out product', async () => {
    const rejected = await postJson(baseUrl, '/orders', {
      key: 'stock-rejected',
      body: order(soldOut.id, 1),
    });

    assert.equal(rejected.response.status, 409);
    assert.deepEqual(await stockOf(soldOut), { stock: 0, inStock: false });
    assert.deepEqual(await stockOf(available), { stock: 99, inStock: true });
  });

  it('keeps the existing errors of the detail endpoints', async () => {
    const missing = await requestJson(baseUrl, '/products/product-does-not-exist');
    const failed = await requestJson(baseUrl, `/products/${available.id}?fail=true`);

    assert.equal(missing.response.status, 404);
    assert.equal('stock' in missing.body, false);
    assert.equal(failed.response.status, 500);
  });
});

describe('catalog latency and controlled failures', () => {
  it('waits before 500 responses on every catalog endpoint', async () => {
    const latencyMs = 25;
    const server = createApp({ latencyMs }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const paths = [
        '/home?fail=true',
        '/categories?fail=true',
        '/products?fail=true',
        '/brands?fail=true',
      ];
      const startedAt = performance.now();
      const results = await Promise.all(paths.map((path) => requestJson(baseUrl, path)));
      const elapsedMs = performance.now() - startedAt;

      assert.ok(elapsedMs >= latencyMs - 5, `elapsed ${elapsedMs}ms`);
      for (const { response, body } of results) {
        assert.equal(response.status, 500);
        assert.deepEqual(body, {
          error: {
            code: 'SIMULATED_FAILURE',
            message: 'A simulated catalog failure occurred.',
          },
        });
      }
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

describe('order HTTP contracts', () => {
  let baseUrl;
  let server;
  let now = Date.parse('2026-10-10T12:00:00.000Z');

  const product = catalog.find(({ inStock }) => inStock);
  const orderBody = {
    items: [{ productId: product.id, quantity: 1 }],
    shippingAddress: {
      fullName: 'Test Customer',
      phone: '5512345678',
      postalCode: '03100',
      state: 'CDMX',
      city: 'Benito Juárez',
      street: 'Fictional Avenue',
      exteriorNumber: '42',
    },
    currency: 'MXN',
  };

  before(async () => {
    server = createApp({
      latencyMs: 0,
      orderClock: () => now,
      orderIdFactory: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      orderProcessingMs: 5_000,
    }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('returns safe field errors for missing key and strict invalid payloads', async () => {
    const missingKey = await postJson(baseUrl, '/orders', { body: orderBody });
    const invalid = await postJson(baseUrl, '/orders', {
      key: 'invalid-key',
      body: {
        ...orderBody,
        shippingAddress: {
          ...orderBody.shippingAddress,
          phone: 'private-phone',
        },
        extra: 'private-value',
      },
    });

    assert.equal(missingKey.response.status, 400);
    assert.deepEqual(missingKey.body, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Order request validation failed',
      },
      fields: { 'Idempotency-Key': 'REQUIRED' },
    });
    assert.equal(invalid.response.status, 400);
    assert.deepEqual(invalid.body.fields, {
      extra: 'ADDITIONAL_PROPERTY',
      'shippingAddress.phone': 'INVALID_FORMAT',
    });
    assert.equal(JSON.stringify(invalid.body).includes('private'), false);

    const status = await requestJson(baseUrl, '/orders/status/invalid-key');
    assert.equal(status.response.status, 404);
    assert.deepEqual(status.body, {
      status: 'not_created',
      error: {
        code: 'ORDER_NOT_CREATED',
        message: 'No order attempt exists for this key',
      },
    });
  });

  it('adapts pending retries, conflicts, confirmation, and sanitized status', async () => {
    const first = await postJson(baseUrl, '/orders', {
      key: 'http-flow-key',
      body: orderBody,
    });
    const retry = await postJson(baseUrl, '/orders', {
      key: 'http-flow-key',
      body: {
        currency: 'MXN',
        shippingAddress: {
          ...orderBody.shippingAddress,
          fullName: ' Test Customer ',
        },
        items: orderBody.items,
      },
    });
    const conflict = await postJson(baseUrl, '/orders', {
      key: 'http-flow-key',
      body: { ...orderBody, currency: 'USD' },
    });

    assert.equal(first.response.status, 202);
    assert.deepEqual(first.body, {
      status: 'pending',
      retryAfterSeconds: 5,
      key: 'http-flow-key',
    });
    assert.deepEqual(retry.body, first.body);
    assert.equal(conflict.response.status, 409);
    assert.deepEqual(conflict.body, {
      status: 'pending',
      links: { status: '/orders/status/http-flow-key' },
      error: {
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'The idempotency key is already associated with another request',
      },
    });

    now += 5_000;
    const status = await requestJson(baseUrl, '/orders/status/http-flow-key');
    const confirmedRetry = await postJson(baseUrl, '/orders', {
      key: 'http-flow-key',
      body: orderBody,
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.body.status, 'confirmed');
    assert.deepEqual(confirmedRetry.body, status.body);
    assert.match(status.body.order.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(status.body.order.createdAt, '2026-10-10T12:00:00.000Z');
    const serialized = JSON.stringify(status.body);
    assert.equal(serialized.includes('shippingAddress'), false);
    assert.equal(serialized.includes('Test Customer'), false);
    assert.equal(serialized.includes('5512345678'), false);
  });

  it('distinguishes out of stock from key reuse without activating the rejected key', async () => {
    const unavailable = catalog.find(({ inStock }) => !inStock);
    const result = await postJson(baseUrl, '/orders', {
      key: 'stock-key',
      body: {
        ...orderBody,
        items: [{ productId: unavailable.id, quantity: 1 }],
      },
    });

    assert.equal(result.response.status, 409);
    assert.deepEqual(result.body, {
      error: {
        code: 'OUT_OF_STOCK',
        message: 'One or more products do not have enough stock',
      },
    });
    const status = await requestJson(baseUrl, '/orders/status/stock-key');
    assert.equal(status.response.status, 404);
    assert.equal(status.body.status, 'not_created');
  });

  it('returns the approved expired envelope at the 24-hour boundary', async () => {
    now += 24 * 60 * 60 * 1000 - 5_000;
    const getResult = await requestJson(baseUrl, '/orders/status/http-flow-key');
    const postResult = await postJson(baseUrl, '/orders', {
      key: 'http-flow-key',
      body: orderBody,
    });

    for (const result of [getResult, postResult]) {
      assert.equal(result.response.status, 410);
      assert.deepEqual(result.body, {
        status: 'expired',
        error: {
          code: 'IDEMPOTENCY_KEY_EXPIRED',
          message: 'The idempotency key has expired',
        },
      });
    }
  });
});

describe('JSON error envelope for unmatched routes and body errors', () => {
  let baseUrl;
  let server;

  before(async () => {
    server = createApp({ latencyMs: 0 }).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('answers unknown routes with a JSON NOT_FOUND envelope and no route echo', async () => {
    for (const [method, path] of [
      ['GET', '/nope'],
      ['POST', '/nope'],
      ['GET', '/orders/unknown/deep'],
    ]) {
      const response = await fetch(`${baseUrl}${path}`, { method });
      const text = await response.text();

      assert.equal(response.status, 404, `${method} ${path}`);
      assert.match(response.headers.get('content-type'), /^application\/json/);
      assert.deepEqual(JSON.parse(text), {
        error: { code: 'NOT_FOUND', message: 'The requested route was not found.' },
      });
      assert.equal(text.includes('nope'), false);
    }
  });

  it('answers bodies above the JSON limit with a 413 envelope instead of 500', async () => {
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'big' },
      body: JSON.stringify({ padding: 'x'.repeat(200 * 1024) }),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(body, {
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'The request body is too large.',
      },
    });
  });

  it('keeps the existing malformed JSON contract for orders', async () => {
    const response = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'bad' },
      body: '{"items": [',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Order request validation failed',
      },
      fields: { root: 'INVALID_FORMAT' },
    });
  });
});
