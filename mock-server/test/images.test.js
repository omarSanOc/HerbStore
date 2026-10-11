import assert from 'node:assert/strict';
import { request } from 'node:http';
import { after, before, describe, it } from 'node:test';
import { crc32 as referenceCrc32, inflateSync } from 'node:zlib';

import { generateCatalog } from '../src/catalog/generate-catalog.js';
import { crc32, createPlaceholderPng } from '../src/catalog/placeholder-png.js';
import { createApp } from '../src/server.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Splits a PNG into chunks, checking each CRC against Node's own implementation. */
function readPng(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), PNG_SIGNATURE, 'PNG signature');

  const chunks = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const storedCrc = bytes.readUInt32BE(offset + 8 + length);
    assert.equal(
      storedCrc,
      referenceCrc32(bytes.subarray(offset + 4, offset + 8 + length)),
      `CRC of ${type}`,
    );
    chunks.push({ type, data });
    offset += 12 + length;
  }
  assert.equal(offset, bytes.length, 'no trailing bytes');
  assert.deepEqual(
    chunks.map(({ type }) => type),
    ['IHDR', 'IDAT', 'IEND'],
  );

  const header = chunks[0].data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const [bitDepth, colorType, compression, filter, interlace] = header.subarray(8, 13);
  assert.deepEqual([bitDepth, colorType, compression, filter, interlace], [8, 2, 0, 0, 0]);

  const raw = inflateSync(chunks[1].data);
  assert.equal(raw.length, height * (1 + width * 3), 'decoded scanline size');

  return { width, height };
}

/** `fetch` hides revalidation details, so conditional requests go through `node:http`. */
function getStatus(url, headers) {
  return new Promise((resolve, reject) => {
    const outgoing = request(url, { headers }, (incoming) => {
      incoming.resume();
      incoming.on('end', () => resolve(incoming.statusCode));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}

async function getImage(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

describe('placeholder PNG encoder', () => {
  it('computes CRC32 like the standard check value', () => {
    assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
    assert.equal(crc32(Buffer.alloc(0)), 0);
  });

  it('agrees with Node on arbitrary bytes', () => {
    const bytes = Buffer.from(Array.from({ length: 1000 }, (_, index) => (index * 31) % 256));
    assert.equal(crc32(bytes), referenceCrc32(bytes));
  });

  it('produces the same bytes for the same input and different bytes for another seed', () => {
    const first = createPlaceholderPng({ width: 32, height: 16, seed: 'a' });
    const second = createPlaceholderPng({ width: 32, height: 16, seed: 'a' });
    const other = createPlaceholderPng({ width: 32, height: 16, seed: 'b' });

    assert.ok(first.equals(second));
    assert.ok(!first.equals(other));
    assert.deepEqual(readPng(first), { width: 32, height: 16 });
  });

  it('rejects unusable dimensions', () => {
    assert.throws(() => createPlaceholderPng({ width: 0, height: 10, seed: 'a' }), RangeError);
    assert.throws(() => createPlaceholderPng({ width: 10, height: 1.5, seed: 'a' }), RangeError);
  });
});

describe('fictional image endpoint', () => {
  const catalog = generateCatalog();
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
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('serves each banner as a 640x360 image/png', async () => {
    const home = await (await fetch(`${baseUrl}/home`)).json();
    assert.ok(home.banners.length > 0);

    for (const banner of home.banners) {
      const { response, bytes } = await getImage(baseUrl, banner.imageUrl);

      assert.equal(response.status, 200, banner.imageUrl);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(readPng(bytes), { width: 640, height: 360 });
    }
  });

  it('serves each category as a 128x128 image/png', async () => {
    const home = await (await fetch(`${baseUrl}/home`)).json();
    assert.equal(home.categories.length, 5);

    for (const category of home.categories) {
      const { response, bytes } = await getImage(baseUrl, category.imageUrl);

      assert.equal(response.status, 200, category.imageUrl);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(readPng(bytes), { width: 128, height: 128 });
    }
  });

  it('serves every product image the home sections reference as a 256x256 image/png', async () => {
    const home = await (await fetch(`${baseUrl}/home`)).json();
    const paths = home.sections.flatMap(({ items }) => items.flatMap(({ images }) => images));
    assert.ok(paths.length >= 20);

    for (const path of paths) {
      const { response, bytes } = await getImage(baseUrl, path);

      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.deepEqual(readPng(bytes), { width: 256, height: 256 });
    }
  });

  it('serves every image the catalog references (first and last included)', async () => {
    const paths = catalog.flatMap(({ images }) => images);
    assert.equal(paths.length, 600);
    assert.ok(paths.includes('/images/products/product-001-front.png'));
    assert.ok(paths.includes('/images/products/product-300-detail.png'));

    const statuses = await Promise.all(
      paths.map(async (path) => (await fetch(`${baseUrl}${path}`)).status),
    );

    assert.deepEqual([...new Set(statuses)], [200]);
  });

  it('is deterministic per name and distinct between names', async () => {
    const first = await getImage(baseUrl, '/images/products/product-001-front.png');
    const again = await getImage(baseUrl, '/images/products/product-001-front.png');
    const detail = await getImage(baseUrl, '/images/products/product-001-detail.png');
    const banner = await getImage(baseUrl, '/images/banners/daily-wellness.png');
    const otherBanner = await getImage(baseUrl, '/images/banners/plant-powered.png');

    assert.ok(first.bytes.equals(again.bytes));
    assert.ok(!first.bytes.equals(detail.bytes));
    assert.ok(!banner.bytes.equals(otherBanner.bytes));
  });

  it('sets cacheable headers and answers a conditional request with 304', async () => {
    const path = '/images/categories/vitamins.png';
    const first = await fetch(`${baseUrl}${path}`);
    const etag = first.headers.get('etag');

    assert.match(first.headers.get('cache-control') ?? '', /max-age=\d+/);
    assert.equal(first.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(etag);

    await first.arrayBuffer();
    assert.equal(await getStatus(`${baseUrl}${path}`, { 'If-None-Match': etag }), 304);
    assert.equal(await getStatus(`${baseUrl}${path}`, { 'If-None-Match': '"other"' }), 200);
  });

  it('answers HEAD with image/png and no body', async () => {
    const response = await fetch(`${baseUrl}/images/banners/daily-wellness.png`, {
      method: 'HEAD',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
  });

  it('does not delay images with the catalog latency', async () => {
    const slow = createApp({ latencyMs: 400 }).listen(0, '127.0.0.1');
    await new Promise((resolve) => slow.once('listening', resolve));
    try {
      const startedAt = Date.now();
      const response = await fetch(
        `http://127.0.0.1:${slow.address().port}/images/categories/vitamins.png`,
      );
      await response.arrayBuffer();

      assert.equal(response.status, 200);
      assert.ok(Date.now() - startedAt < 300);
    } finally {
      await new Promise((resolve) => slow.close(resolve));
    }
  });

  const unknownPaths = [
    ['unknown kind', '/images/avatars/daily-wellness.png'],
    ['unknown banner', '/images/banners/missing.png'],
    ['unknown category', '/images/categories/missing.png'],
    ['product beyond the catalog', '/images/products/product-301-front.png'],
    ['product before the catalog', '/images/products/product-000-front.png'],
    ['unknown product variant', '/images/products/product-001-back.png'],
    ['kind mismatch', '/images/categories/daily-wellness.png'],
    ['other extension', '/images/banners/daily-wellness.jpg'],
    ['missing extension', '/images/banners/daily-wellness'],
    ['uppercase name', '/images/banners/DAILY-WELLNESS.png'],
    ['encoded traversal', '/images/banners/..%2F..%2Fpackage.json'],
    ['encoded dots traversal', '/images/%2e%2e/package.json'],
    ['double encoded traversal', '/images/banners/%252e%252e%252fpackage.json'],
    ['backslash traversal', '/images/banners/..%5C..%5Cpackage.json'],
    ['null byte', '/images/banners/daily-wellness.png%00'],
    ['missing name', '/images/banners'],
  ];

  for (const [label, path] of unknownPaths) {
    it(`answers 404 JSON without echoing the input: ${label}`, async () => {
      const response = await fetch(`${baseUrl}${path}`);
      const text = await response.text();

      assert.equal(response.status, 404);
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      assert.deepEqual(JSON.parse(text), {
        error: { code: 'NOT_FOUND', message: 'The requested route was not found.' },
      });
      assert.ok(!text.includes('missing'), 'no echo of the requested name');
      assert.ok(!text.includes('package.json'), 'no echo of the requested path');
    });
  }

  it('does not serve images over other methods', async () => {
    const response = await fetch(`${baseUrl}/images/banners/daily-wellness.png`, {
      method: 'POST',
    });

    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  });
});
