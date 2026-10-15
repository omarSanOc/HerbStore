/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeIncomingUrl } from '../../../core/navigation/linking.ts';
import { createInstance } from 'i18next';

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';
import { buildProductShareRequest, buildProductShareUrl } from './product-share.ts';

describe('buildProductShareUrl', () => {
  it('builds the app deep link of the product', () => {
    assert.equal(buildProductShareUrl('product-261009-043'), 'herbstore://product/product-261009-043');
  });

  it('builds a link that the deep link normalizer routes back to the same product', () => {
    for (const id of ['product-261009-001', 'product-261009-043', 'product-261009-300']) {
      const url = buildProductShareUrl(id);

      assert.ok(url !== undefined);
      assert.equal(normalizeIncomingUrl(url), `/product/${id}`);
    }
  });

  it('never builds a link for an id that is not catalog shaped', () => {
    for (const id of ['', 'product-1', 'x', ' product-261009-043', 'product-261009-043/../x', 'product-261009-0431']) {
      assert.equal(buildProductShareUrl(id), undefined, id);
    }
    assert.equal(buildProductShareUrl(undefined as unknown as string), undefined);
  });
});

/** The same options as `core/i18n/index.ts` (which cannot load in Node: it needs expo-localization). */
async function translatorFor(language: 'es' | 'en') {
  const i18n = createInstance();
  await i18n.init({
    compatibilityJSON: 'v4',
    fallbackLng: 'es',
    interpolation: { escapeValue: false },
    lng: language,
    resources: { en, es },
  });
  return i18n.t.bind(i18n) as (key: string, options?: Record<string, string>) => string;
}

describe('buildProductShareRequest (RF-26: active language + the app link)', () => {
  const product = { id: 'product-261009-043', name: 'Ashwagandha & Cacao "Focus"' };
  const url = 'herbstore://product/product-261009-043';

  it('hands the native sheet a Spanish text and a Spanish dialog title when the app is in Spanish', async () => {
    const request = buildProductShareRequest(product, await translatorFor('es'));

    assert.ok(request !== undefined);
    assert.equal(request.content.message, `Mira ${product.name} en HerbStore: ${url}`);
    assert.equal(request.options.dialogTitle, 'Compartir producto');
  });

  it('hands it an English text and an English dialog title when the app is in English', async () => {
    const request = buildProductShareRequest(product, await translatorFor('en'));

    assert.ok(request !== undefined);
    assert.equal(request.content.message, `Check out ${product.name} on HerbStore: ${url}`);
    assert.equal(request.options.dialogTitle, 'Share product');
  });

  it('keeps the link verbatim inside the message in both languages (Android ignores a separate url)', async () => {
    for (const language of ['es', 'en'] as const) {
      const request = buildProductShareRequest(product, await translatorFor(language));

      assert.ok(request !== undefined);
      assert.ok(request.content.message.includes(url), language);
      assert.equal(request.content.message.split(url).length - 1, 1, 'exactly once');
      assert.equal(request.url, url);
    }
  });

  it('uses the product name as title and subject, whatever the language', async () => {
    const request = buildProductShareRequest(product, await translatorFor('en'));

    assert.ok(request !== undefined);
    assert.equal(request.content.title, product.name);
    assert.equal(request.options.subject, product.name);
  });

  it('builds nothing for an id the product route would reject', async () => {
    const translate = await translatorFor('es');

    for (const id of ['', 'product-1', 'product-261009-043/../x']) {
      assert.equal(buildProductShareRequest({ id, name: 'X' }, translate), undefined, id);
    }
  });
});
