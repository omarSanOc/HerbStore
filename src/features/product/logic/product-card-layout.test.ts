/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getGridColumnCount, getProductCardWidth } from './product-card-layout.ts';

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

describe('getGridColumnCount', () => {
  it('is the two columns of the spec at every size up to 1.5x', () => {
    assert.equal(getGridColumnCount(0.85), 2);
    assert.equal(getGridColumnCount(1), 2);
    assert.equal(getGridColumnCount(1.3), 2);
    assert.equal(getGridColumnCount(1.5), 2);
  });

  it('falls back to one column beyond 1.5x so a name and a price keep a readable width', () => {
    assert.equal(getGridColumnCount(1.51), 1);
    assert.equal(getGridColumnCount(2), 1);
    assert.equal(getGridColumnCount(3.1), 1);
  });

  it('ignores an invalid scale', () => {
    assert.equal(getGridColumnCount(Number.NaN), 2);
    assert.equal(getGridColumnCount(0), 2);
  });
});
