/// <reference types="node" />
// H-1/H-11 (= S-4, spec 006 T6c). On Android an icon of `SymbolView` is a `Text` that draws one
// character of the Material Symbols font, and a `Text` scales with the system font size; its box
// does not. From `font_scale` 1.3 the glyph outgrew the box and was cut. The icon must keep the size
// it was given (as an SF Symbol does on iOS): the font size is divided by the scale so the scaled
// glyph is `size` again, and the box is stated explicitly.
//
// Compose: `Icon(modifier = Modifier.size(24.dp))` is in dp, so it never scaled; SwiftUI: an SF Symbol
// with a fixed `.font(.system(size:))` ignores Dynamic Type unless `@ScaledMetric` is used.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fixedIconGeometry } from './icon-size.ts';

describe('fixedIconGeometry', () => {
  it('is the plain size at the default font scale', () => {
    assert.deepEqual(fixedIconGeometry(26, 1), { box: 26, fontSize: 26 });
  });

  it('divides the font size by the scale, so the scaled glyph is the requested size again', () => {
    for (const scale of [1.3, 1.5, 2]) {
      const { box, fontSize } = fixedIconGeometry(26, scale);
      assert.equal(box, 26);
      assert.ok(Math.abs(fontSize * scale - 26) < 1e-9, `scale ${scale}`);
    }
  });

  it('works under 1 too (a smaller system font)', () => {
    const { box, fontSize } = fixedIconGeometry(24, 0.85);
    assert.equal(box, 24);
    assert.ok(Math.abs(fontSize * 0.85 - 24) < 1e-9);
  });

  it('falls back to the plain size for a scale that is not usable', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.deepEqual(fixedIconGeometry(24, bad), { box: 24, fontSize: 24 }, String(bad));
    }
  });
});
