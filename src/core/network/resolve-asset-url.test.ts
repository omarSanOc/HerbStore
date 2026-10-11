/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAssetUrl } from './resolve-asset-url.ts';

const ORIGIN = 'http://localhost:3001';

describe('resolveAssetUrl', () => {
  it('joins the origin with the server paths of banners, categories and products', () => {
    assert.equal(
      resolveAssetUrl(ORIGIN, '/images/banners/daily-wellness.png'),
      'http://localhost:3001/images/banners/daily-wellness.png',
    );
    assert.equal(
      resolveAssetUrl(ORIGIN, '/images/categories/vitamins.png'),
      'http://localhost:3001/images/categories/vitamins.png',
    );
    assert.equal(
      resolveAssetUrl(ORIGIN, '/images/products/product-001-front.png'),
      'http://localhost:3001/images/products/product-001-front.png',
    );
  });

  it('never duplicates or drops the slash between origin and path', () => {
    const expected = 'http://localhost:3001/images/banners/a.png';

    assert.equal(resolveAssetUrl('http://localhost:3001/', '/images/banners/a.png'), expected);
    assert.equal(resolveAssetUrl('http://localhost:3001//', '/images/banners/a.png'), expected);
    assert.equal(resolveAssetUrl(ORIGIN, 'images/banners/a.png'), expected);
    assert.equal(resolveAssetUrl('http://localhost:3001/', 'images/banners/a.png'), expected);
  });

  it('keeps query and fragment', () => {
    assert.equal(
      resolveAssetUrl(ORIGIN, '/images/banners/a.png?v=2#top'),
      'http://localhost:3001/images/banners/a.png?v=2#top',
    );
  });

  it('works with other origins, ports and https', () => {
    assert.equal(
      resolveAssetUrl('http://10.0.2.2:3001', '/images/categories/protein.png'),
      'http://10.0.2.2:3001/images/categories/protein.png',
    );
    assert.equal(
      resolveAssetUrl('https://cdn.herbstore.test', '/images/categories/protein.png'),
      'https://cdn.herbstore.test/images/categories/protein.png',
    );
  });

  it('lets an absolute URL on the same origin through, unchanged', () => {
    const url = 'http://localhost:3001/images/banners/a.png';

    assert.equal(resolveAssetUrl(ORIGIN, url), url);
    assert.equal(resolveAssetUrl(ORIGIN, 'HTTP://LOCALHOST:3001/images/banners/a.png'), 'HTTP://LOCALHOST:3001/images/banners/a.png');
  });

  it('rejects absolute URLs on another host, port or scheme', () => {
    assert.equal(resolveAssetUrl(ORIGIN, 'http://evil.test/images/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'http://localhost:3002/images/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'https://localhost:3001/images/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'http://localhost:3001.evil.test/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'http://localhost:3001@evil.test/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'http://localhost:3001'), undefined);
  });

  it('rejects protocol-relative URLs and non-HTTP schemes', () => {
    assert.equal(resolveAssetUrl(ORIGIN, '//evil.test/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '///evil.test/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'javascript:alert(1)'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'data:image/png;base64,AAAA'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'file:///etc/passwd'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'ftp://localhost:3001/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 'content://media/external/a.png'), undefined);
  });

  it('rejects backslashes, whitespace and control characters', () => {
    assert.equal(resolveAssetUrl(ORIGIN, '/\\evil.test/a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '\\\\evil.test\\a.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '/images/a b.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '/images/a\n.png'), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '/images/a\u0000.png'), undefined);
  });

  it('returns undefined for missing or non-string paths', () => {
    assert.equal(resolveAssetUrl(ORIGIN, undefined), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, null), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, ''), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, '   '), undefined);
    assert.equal(resolveAssetUrl(ORIGIN, 42 as unknown as string), undefined);
  });

  it('returns undefined when the origin itself is not a bare http(s) origin', () => {
    assert.equal(resolveAssetUrl('', '/images/a.png'), undefined);
    assert.equal(resolveAssetUrl('localhost:3001', '/images/a.png'), undefined);
    assert.equal(resolveAssetUrl('http://localhost:3001/api', '/images/a.png'), undefined);
    assert.equal(resolveAssetUrl('ftp://localhost:3001', '/images/a.png'), undefined);
  });
});
