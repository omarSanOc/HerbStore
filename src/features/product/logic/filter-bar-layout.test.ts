/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getFilterItemMaxWidth } from './filter-bar-layout.ts';

describe('getFilterItemMaxWidth', () => {
  it('is the width the row shows: the window minus the inset on both sides', () => {
    assert.equal(getFilterItemMaxWidth({ windowWidth: 360, horizontalInset: 16, minimumWidth: 48 }), 328);
    assert.equal(getFilterItemMaxWidth({ windowWidth: 402, horizontalInset: 16, minimumWidth: 48 }), 370);
  });

  it('never goes below the minimum touch target, even on a tiny window', () => {
    assert.equal(getFilterItemMaxWidth({ windowWidth: 60, horizontalInset: 16, minimumWidth: 48 }), 48);
    assert.equal(getFilterItemMaxWidth({ windowWidth: 0, horizontalInset: 16, minimumWidth: 48 }), 48);
  });

  it('falls back to the minimum for an invalid window width', () => {
    assert.equal(
      getFilterItemMaxWidth({ windowWidth: Number.NaN, horizontalInset: 16, minimumWidth: 48 }),
      48,
    );
  });
});
