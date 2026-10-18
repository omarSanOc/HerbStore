/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { scaleWithFont } from './scaled-size.ts';

describe('scaleWithFont', () => {
  it('keeps the base size at the default scale and under it', () => {
    assert.equal(scaleWithFont(8, 1), 8);
    assert.equal(scaleWithFont(8, 0.85), 8);
  });

  it('grows with the font scale (H-7: the gap between category labels; H-12: placeholder lines)', () => {
    assert.equal(scaleWithFont(8, 1.5), 12);
    assert.equal(scaleWithFont(8, 2), 16);
    assert.equal(scaleWithFont(20, 2), 40);
    // iOS AX5 is about 3.1x: the size keeps pace instead of staying at the 1x value.
    assert.ok(scaleWithFont(8, 3.1) > 24);
  });

  it('falls back to the base size for an invalid scale', () => {
    assert.equal(scaleWithFont(8, Number.NaN), 8);
    assert.equal(scaleWithFont(8, Number.POSITIVE_INFINITY), 8);
  });
});
