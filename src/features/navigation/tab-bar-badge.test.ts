/// <reference types="node" />
// RF-13 (spec 006, T6c). The navigator's `Badge` paints `colors.notification` (rgb(255, 59, 48)) with
// white text: 3.55:1, under the 4.5:1 that 12 pt text needs, in BOTH themes (the app does not give
// the navigator a theme). The badge takes its fill from the app palette instead.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CONTRAST_MINIMUM, contrastRatio, navigationBadgeText } from '../../design-system/contrast.ts';
import { palettes } from '../../design-system/palettes.ts';
import { getTabBarBadgeStyle } from './tab-bar-badge.ts';

describe('getTabBarBadgeStyle', () => {
  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: fills the badge with the palette error color and its text reaches 4.5:1`, () => {
      const style = getTabBarBadgeStyle(palettes[scheme]);

      assert.equal(style.backgroundColor, palettes[scheme].error);
      const text = navigationBadgeText(String(style.backgroundColor));
      assert.ok(contrastRatio(text, String(style.backgroundColor)) >= CONTRAST_MINIMUM.normalText);
    });
  }

  it('keeps the layout that shows "99+" complete (anchored by its start edge, 12 pt)', () => {
    const style = getTabBarBadgeStyle(palettes.light);

    assert.equal(style.start, 21);
    assert.equal(style.top, -4);
    assert.equal(style.end, undefined);
    assert.equal(style.fontSize, 12);
    assert.equal(style.paddingHorizontal, 3);
  });
});
