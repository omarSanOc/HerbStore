/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';
import { KNOWN_BANNER_IDS, bannerCopyKeys } from './banner-copy.ts';

describe('bannerCopyKeys', () => {
  it('knows the two banners the mock server sends', () => {
    assert.deepEqual([...KNOWN_BANNER_IDS], ['daily-wellness', 'plant-powered']);
  });

  it('returns the title and subtitle keys of a known id', () => {
    assert.deepEqual(bannerCopyKeys('daily-wellness'), {
      title: 'home.banners.items.daily-wellness.title',
      subtitle: 'home.banners.items.daily-wellness.subtitle',
    });
  });

  it('returns undefined for unknown ids, so the caller shows the server text', () => {
    assert.equal(bannerCopyKeys('spring-sale'), undefined);
    assert.equal(bannerCopyKeys(''), undefined);
    assert.equal(bannerCopyKeys('constructor'), undefined);
    assert.equal(bannerCopyKeys('__proto__'), undefined);
  });

  it('has Spanish and English text for every known id', () => {
    for (const id of KNOWN_BANNER_IDS) {
      for (const resources of [en, es]) {
        const item = resources.translation.home.banners.items[id];
        assert.ok(item.title.trim().length > 0, `${id} title`);
        assert.ok(item.subtitle.trim().length > 0, `${id} subtitle`);
      }
    }
  });
});
