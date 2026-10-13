/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldStackActions, type ActionBarLayoutInput } from './action-bar-layout.ts';

// The numbers the app really uses: the sheet has 16 of side margin, the buttons 8 between them, a
// button adds 34 around its label (16 + 16 of padding and 2 of border), the label is 16 at scale 1
// and the longest label ("Cancelar", measured on iOS and Android) is 4 em wide. The scale cap is 2.
const base: ActionBarLayoutInput = {
  windowWidth: 402,
  horizontalInset: 16,
  gap: 8,
  fontScale: 1,
  maxFontScale: 2,
  baseFontSize: 16,
  longestLabelEm: 4,
  buttonChrome: 34,
};

describe('shouldStackActions', () => {
  it('keeps the row at the normal scale, even on a narrow phone', () => {
    assert.equal(shouldStackActions(base), false);
    assert.equal(shouldStackActions({ ...base, windowWidth: 320 }), false);
  });

  it('keeps the row on Android at its largest scale (2.0 on a 384 dp window: 162 needed, 172 free)', () => {
    assert.equal(shouldStackActions({ ...base, windowWidth: 384, fontScale: 2 }), false);
  });

  it('stacks when one button cannot hold the longest label (360 dp at 2.0: 162 needed, 160 free)', () => {
    assert.equal(shouldStackActions({ ...base, windowWidth: 360, fontScale: 2 }), true);
  });

  it('caps the scale that counts: iOS AX5 (3.571) on a 402 pt window fits as 2.0 does', () => {
    assert.equal(shouldStackActions({ ...base, fontScale: 3.571 }), false);
    assert.equal(shouldStackActions({ ...base, fontScale: 3.571, windowWidth: 360 }), true);
  });

  it('without a cap, a large scale stacks (the label would not fit a half row)', () => {
    assert.equal(shouldStackActions({ ...base, fontScale: 3.571, maxFontScale: Infinity }), true);
  });

  it('is exact at the boundary: it fits when needed equals free', () => {
    // free = (windowWidth - 2 * 16 - 8) / 2 ; needed = 16 * 4 * scale + 34
    assert.equal(shouldStackActions({ ...base, windowWidth: 372, fontScale: 2 }), false); // 166 vs 162
    assert.equal(shouldStackActions({ ...base, windowWidth: 364, fontScale: 2 }), false); // 162 vs 162
    assert.equal(shouldStackActions({ ...base, windowWidth: 363, fontScale: 2 }), true); // 161.5 vs 162
  });

  it('treats an invalid scale as 1 and an invalid window as "stack" (a full row always fits)', () => {
    assert.equal(shouldStackActions({ ...base, fontScale: Number.NaN }), false);
    assert.equal(shouldStackActions({ ...base, fontScale: 0 }), false);
    assert.equal(shouldStackActions({ ...base, windowWidth: Number.NaN }), true);
    assert.equal(shouldStackActions({ ...base, windowWidth: 0 }), true);
  });
});
