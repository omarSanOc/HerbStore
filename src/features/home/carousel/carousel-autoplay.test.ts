/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUTOPLAY_INTERVAL_MS,
  nextBannerIndex,
  shouldAutoplay,
  type AutoplayConditions,
} from './carousel-autoplay.ts';

// Everything that allows autoplay; each test breaks exactly one condition.
const running: AutoplayConditions = {
  bannerCount: 3,
  isFocused: true,
  isAppActive: true,
  isRowVisible: true,
  reducedMotion: false,
  isInteracting: false,
};

describe('AUTOPLAY_INTERVAL_MS', () => {
  it('is the 5 seconds of RF-12', () => {
    assert.equal(AUTOPLAY_INTERVAL_MS, 5000);
  });
});

describe('shouldAutoplay', () => {
  it('runs with several banners and nothing pausing it', () => {
    assert.equal(shouldAutoplay(running), true);
    assert.equal(shouldAutoplay({ ...running, bannerCount: 2 }), true);
  });

  it('never runs with zero or one banner (nothing to advance to)', () => {
    assert.equal(shouldAutoplay({ ...running, bannerCount: 0 }), false);
    assert.equal(shouldAutoplay({ ...running, bannerCount: 1 }), false);
  });

  it('treats nonsensical counts as no autoplay', () => {
    assert.equal(shouldAutoplay({ ...running, bannerCount: -2 }), false);
    assert.equal(shouldAutoplay({ ...running, bannerCount: Number.NaN }), false);
  });

  it('pauses when the screen is not focused (other tab, pushed product, modal)', () => {
    assert.equal(shouldAutoplay({ ...running, isFocused: false }), false);
  });

  it('pauses when the app is not active (background, inactive)', () => {
    assert.equal(shouldAutoplay({ ...running, isAppActive: false }), false);
  });

  it('pauses when the banner row is scrolled out of the viewport', () => {
    assert.equal(shouldAutoplay({ ...running, isRowVisible: false }), false);
  });

  it('is off with reduced motion (RNF-2)', () => {
    assert.equal(shouldAutoplay({ ...running, reducedMotion: true }), false);
  });

  it('pauses while the user touches or drags', () => {
    assert.equal(shouldAutoplay({ ...running, isInteracting: true }), false);
  });

  it('needs every condition at once', () => {
    assert.equal(
      shouldAutoplay({
        bannerCount: 5,
        isFocused: false,
        isAppActive: false,
        isRowVisible: false,
        reducedMotion: true,
        isInteracting: true,
      }),
      false,
    );
  });
});

describe('nextBannerIndex', () => {
  it('advances one banner at a time', () => {
    assert.equal(nextBannerIndex(0, 3), 1);
    assert.equal(nextBannerIndex(1, 3), 2);
  });

  it('wraps from the last banner to the first (0 -> 1 -> ... -> N-1 -> 0)', () => {
    assert.equal(nextBannerIndex(2, 3), 0);
    assert.equal(nextBannerIndex(1, 2), 0);
    assert.equal(nextBannerIndex(0, 2), 1);
  });

  it('walks a full cycle and comes back', () => {
    let index = 0;
    const visited = [index];
    for (let step = 0; step < 4; step += 1) {
      index = nextBannerIndex(index, 4);
      visited.push(index);
    }
    assert.deepEqual(visited, [0, 1, 2, 3, 0]);
  });

  it('stays on the first banner with zero or one banner', () => {
    assert.equal(nextBannerIndex(0, 0), 0);
    assert.equal(nextBannerIndex(0, 1), 0);
    assert.equal(nextBannerIndex(5, 1), 0);
  });

  it('recovers from an index outside the range', () => {
    assert.equal(nextBannerIndex(9, 3), 0);
    assert.equal(nextBannerIndex(-4, 3), 1);
    assert.equal(nextBannerIndex(Number.NaN, 3), 1);
  });
});
