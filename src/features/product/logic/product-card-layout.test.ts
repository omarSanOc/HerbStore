/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getProductCardWidth } from './product-card-layout.ts';

describe('getProductCardWidth', () => {
  it('keeps the base width at the default and smaller font scales', () => {
    assert.equal(getProductCardWidth(160, 1), 160);
    assert.equal(getProductCardWidth(160, 0.85), 160);
  });

  it('grows with the font scale so a price is not split across lines', () => {
    assert.equal(getProductCardWidth(160, 1.25), 200);
    assert.equal(getProductCardWidth(160, 1.5), 240);
  });

  it('stops growing at 1.5x: beyond that the text wraps by words inside the card', () => {
    assert.equal(getProductCardWidth(160, 2), 240);
    assert.equal(getProductCardWidth(160, 3), 240);
  });

  it('ignores an invalid scale', () => {
    assert.equal(getProductCardWidth(160, Number.NaN), 160);
    assert.equal(getProductCardWidth(160, 0), 160);
  });
});
