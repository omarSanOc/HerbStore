/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canStepBanner,
  clampBannerIndex,
  getBannerPosition,
  getCarouselMode,
  indexFromOffset,
  offsetForIndex,
  stepBannerIndex,
} from './banner-pager.ts';

describe('getCarouselMode', () => {
  it('renders nothing for zero (or nonsensical) counts', () => {
    assert.equal(getCarouselMode(0), 'hidden');
    assert.equal(getCarouselMode(-3), 'hidden');
    assert.equal(getCarouselMode(Number.NaN), 'hidden');
  });

  it('shows one banner without paging', () => {
    assert.equal(getCarouselMode(1), 'single');
  });

  it('pages from two banners on', () => {
    assert.equal(getCarouselMode(2), 'paged');
    assert.equal(getCarouselMode(7), 'paged');
  });
});

describe('clampBannerIndex', () => {
  it('keeps a valid index', () => {
    assert.equal(clampBannerIndex(0, 3), 0);
    assert.equal(clampBannerIndex(2, 3), 2);
  });

  it('clamps to the first and last banner', () => {
    assert.equal(clampBannerIndex(-1, 3), 0);
    assert.equal(clampBannerIndex(3, 3), 2);
    assert.equal(clampBannerIndex(99, 3), 2);
  });

  it('returns 0 when there is nothing to point at', () => {
    assert.equal(clampBannerIndex(4, 0), 0);
    assert.equal(clampBannerIndex(Number.NaN, 3), 0);
    assert.equal(clampBannerIndex(Number.POSITIVE_INFINITY, 3), 0);
  });

  it('truncates fractions', () => {
    assert.equal(clampBannerIndex(1.9, 3), 1);
  });
});

describe('indexFromOffset', () => {
  it('maps the settled offsets to their page', () => {
    assert.equal(indexFromOffset(0, 360, 3), 0);
    assert.equal(indexFromOffset(360, 360, 3), 1);
    assert.equal(indexFromOffset(720, 360, 3), 2);
  });

  it('rounds to the nearest page, not down', () => {
    assert.equal(indexFromOffset(179, 360, 3), 0);
    assert.equal(indexFromOffset(181, 360, 3), 1);
    // Fractional page widths (e.g. 361.33) leave sub-pixel remainders.
    assert.equal(indexFromOffset(361.33 * 2 - 0.4, 361.33, 3), 2);
  });

  it('clamps overscroll (iOS bounce) and negative offsets', () => {
    assert.equal(indexFromOffset(-40, 360, 3), 0);
    assert.equal(indexFromOffset(900, 360, 3), 2);
  });

  it('stays at 0 until the width is measured', () => {
    assert.equal(indexFromOffset(360, 0, 3), 0);
    assert.equal(indexFromOffset(360, -1, 3), 0);
    assert.equal(indexFromOffset(360, Number.NaN, 3), 0);
    assert.equal(indexFromOffset(Number.NaN, 360, 3), 0);
  });

  it('is the inverse of offsetForIndex for any width, so a rotation does not desync the index', () => {
    for (const width of [320, 361.33, 412, 768, 1024]) {
      for (let index = 0; index < 5; index += 1) {
        assert.equal(indexFromOffset(offsetForIndex(index, width, 5), width, 5), index);
      }
    }
  });
});

describe('offsetForIndex', () => {
  it('multiplies the (clamped) index by the page width', () => {
    assert.equal(offsetForIndex(0, 360, 3), 0);
    assert.equal(offsetForIndex(2, 360, 3), 720);
    assert.equal(offsetForIndex(9, 360, 3), 720);
    assert.equal(offsetForIndex(-2, 360, 3), 0);
  });

  it('is 0 without a measured width or banners', () => {
    assert.equal(offsetForIndex(2, 0, 3), 0);
    assert.equal(offsetForIndex(2, Number.NaN, 3), 0);
    assert.equal(offsetForIndex(2, 360, 0), 0);
  });
});

describe('stepBannerIndex / canStepBanner', () => {
  it('moves one banner forward or backward', () => {
    assert.equal(stepBannerIndex(0, 3, 1), 1);
    assert.equal(stepBannerIndex(2, 3, -1), 1);
  });

  it('stops at the ends instead of wrapping (manual controls are bounded)', () => {
    assert.equal(stepBannerIndex(0, 3, -1), 0);
    assert.equal(stepBannerIndex(2, 3, 1), 2);
    assert.equal(canStepBanner(0, 3, -1), false);
    assert.equal(canStepBanner(2, 3, 1), false);
    assert.equal(canStepBanner(1, 3, -1), true);
    assert.equal(canStepBanner(1, 3, 1), true);
  });

  it('recovers from a stale index after the list shrank', () => {
    assert.equal(stepBannerIndex(5, 2, -1), 0);
    assert.equal(canStepBanner(5, 2, 1), false);
  });

  it('cannot step with zero or one banner', () => {
    assert.equal(canStepBanner(0, 0, 1), false);
    assert.equal(canStepBanner(0, 1, 1), false);
    assert.equal(canStepBanner(0, 1, -1), false);
    assert.equal(stepBannerIndex(0, 1, 1), 0);
  });
});

describe('getBannerPosition', () => {
  it('is 1-based, for people ("Banner 1 of 2")', () => {
    assert.deepEqual(getBannerPosition(0, 2), { current: 1, total: 2 });
    assert.deepEqual(getBannerPosition(1, 2), { current: 2, total: 2 });
  });

  it('clamps a stale index', () => {
    assert.deepEqual(getBannerPosition(7, 3), { current: 3, total: 3 });
    assert.deepEqual(getBannerPosition(-2, 3), { current: 1, total: 3 });
  });
});
