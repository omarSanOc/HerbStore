/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getScrollOffsetToReveal } from './scroll-into-view.ts';

const viewport = { viewportHeight: 400, margin: 16 };

describe('getScrollOffsetToReveal', () => {
  it('does nothing when the target is already fully visible', () => {
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 120, targetHeight: 100, scrollOffset: 0, ...viewport }),
      undefined,
    );
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 480, targetHeight: 100, scrollOffset: 200, ...viewport }),
      undefined,
    );
  });

  it('scrolls down just enough to show a target that is under the bottom edge (the share error under the bar)', () => {
    // Content 0-400 visible; the message is at 380-480: its bottom plus the margin must fit.
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 380, targetHeight: 100, scrollOffset: 0, ...viewport }),
      96,
    );
  });

  it('scrolls up just enough to show a target above the top edge', () => {
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 150, targetHeight: 100, scrollOffset: 300, ...viewport }),
      134,
    );
  });

  it('aligns a target taller than the viewport by its top, so its beginning is what is read first', () => {
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 500, targetHeight: 450, scrollOffset: 0, ...viewport }),
      484,
    );
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 500, targetHeight: 450, scrollOffset: 484, ...viewport }),
      undefined,
    );
  });

  it('never goes above the start of the content', () => {
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 5, targetHeight: 100, scrollOffset: 60, ...viewport }),
      0,
    );
  });

  it('ignores invalid measurements', () => {
    assert.equal(
      getScrollOffsetToReveal({ targetTop: Number.NaN, targetHeight: 100, scrollOffset: 0, ...viewport }),
      undefined,
    );
    assert.equal(
      getScrollOffsetToReveal({ targetTop: 10, targetHeight: 100, scrollOffset: 0, viewportHeight: Number.NaN, margin: 16 }),
      undefined,
    );
  });
});
