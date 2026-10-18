/// <reference types="node" />
// RF-13 (spec 006, T6c). `contrastRatio` is the WCAG 2.x formula, so it must reproduce the published
// reference values before any palette is judged with it.
//
// Android: `androidx.core.graphics.ColorUtils.calculateContrast`; iOS: no public API, designers use
// the same formula (Accessibility Inspector reports it as "contrast ratio").
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONTRAST_MINIMUM,
  blendOver,
  classifyText,
  contrastRatio,
  highestContrastText,
  navigationBadgeText,
  parseHexColor,
  relativeLuminance,
} from './contrast.ts';

function close(actual: number, expected: number, tolerance = 0.005) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${expected} (+-${tolerance}), got ${actual}`,
  );
}

describe('parseHexColor', () => {
  it('reads #RRGGBB and #RGB, in any case', () => {
    assert.deepEqual(parseHexColor('#176B45'), { r: 0x17, g: 0x6b, b: 0x45 });
    assert.deepEqual(parseHexColor('#176b45'), { r: 0x17, g: 0x6b, b: 0x45 });
    assert.deepEqual(parseHexColor('#fff'), { r: 255, g: 255, b: 255 });
  });

  it('rejects what is not an opaque hex color (a silent NaN would pass every threshold)', () => {
    for (const bad of ['', 'red', '#12', '#12345', '#GGGGGG', '#176B45FF', 'rgb(1,2,3)']) {
      assert.throws(() => parseHexColor(bad), RangeError, bad);
    }
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    assert.equal(relativeLuminance('#000000'), 0);
    assert.equal(relativeLuminance('#FFFFFF'), 1);
  });

  it('weights green most and blue least (Rec. 709 coefficients)', () => {
    close(relativeLuminance('#FF0000'), 0.2126, 0.0001);
    close(relativeLuminance('#00FF00'), 0.7152, 0.0001);
    close(relativeLuminance('#0000FF'), 0.0722, 0.0001);
  });
});

describe('contrastRatio', () => {
  it('black on white is 21:1, in either order', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#FFFFFF', '#000000'), 21);
  });

  it('the same color is 1:1', () => {
    assert.equal(contrastRatio('#176B45', '#176B45'), 1);
    assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  });

  it('matches the published values of the WCAG 2.x techniques (G18)', () => {
    // #767676 is the lightest gray that passes 4.5:1 on white; #777777 is just under it.
    close(contrastRatio('#767676', '#FFFFFF'), 4.54);
    close(contrastRatio('#777777', '#FFFFFF'), 4.48);
    // #595959 on white is the 7:1 level of AAA.
    close(contrastRatio('#595959', '#FFFFFF'), 7.0);
    // A pure green on white (used by W3C as a failing example).
    close(contrastRatio('#00FF00', '#FFFFFF'), 1.37);
  });

  it('accepts the short form and ignores case', () => {
    assert.equal(contrastRatio('#000', '#fff'), 21);
  });
});

describe('thresholds', () => {
  it('are the WCAG AA ones (RF-13)', () => {
    assert.equal(CONTRAST_MINIMUM.normalText, 4.5);
    assert.equal(CONTRAST_MINIMUM.largeText, 3);
    assert.equal(CONTRAST_MINIMUM.uiComponent, 3);
  });
});

describe('classifyText', () => {
  it('is large from 18 pt, or from 14 pt when bold (700+)', () => {
    assert.equal(classifyText({ fontSize: 18, fontWeight: '400' }), 'largeText');
    assert.equal(classifyText({ fontSize: 28, fontWeight: '700' }), 'largeText');
    assert.equal(classifyText({ fontSize: 14, fontWeight: '700' }), 'largeText');
    assert.equal(classifyText({ fontSize: 14, fontWeight: 'bold' }), 'largeText');
  });

  it('is normal under that, and a semi-bold weight does not count as bold', () => {
    assert.equal(classifyText({ fontSize: 16, fontWeight: '400' }), 'normalText');
    assert.equal(classifyText({ fontSize: 16, fontWeight: '600' }), 'normalText');
    assert.equal(classifyText({ fontSize: 17.9, fontWeight: '400' }), 'normalText');
    assert.equal(classifyText({ fontSize: 13.9, fontWeight: '700' }), 'normalText');
    assert.equal(classifyText({ fontSize: 10, fontWeight: '500' }), 'normalText');
  });
});

describe('highestContrastText', () => {
  it('picks white or black, whichever contrasts more (the rule of the native accent button)', () => {
    assert.equal(highestContrastText('#000000'), '#FFFFFF');
    assert.equal(highestContrastText('#FFFFFF'), '#000000');
    assert.equal(highestContrastText('#176B45'), '#FFFFFF');
    assert.equal(highestContrastText('#FFB4AB'), '#000000');
  });

  it('always reaches 4.5:1, so a button painted with it cannot fail the text threshold', () => {
    for (const hex of ['#777777', '#808080', '#767676', '#FF3B30', '#0A84FF']) {
      const text = highestContrastText(hex);
      assert.ok(contrastRatio(text, hex) >= CONTRAST_MINIMUM.normalText, hex);
    }
  });
});

describe('blendOver', () => {
  it('is the foreground at alpha 1 and the background at alpha 0', () => {
    assert.equal(blendOver('#172019', '#FFFFFF', 1), '#172019');
    assert.equal(blendOver('#172019', '#FFFFFF', 0), '#FFFFFF');
  });

  it('mixes channel by channel (a half-transparent black on white is mid gray)', () => {
    assert.equal(blendOver('#000000', '#FFFFFF', 0.5), '#808080');
  });
});

describe('navigationBadgeText', () => {
  // React Navigation draws the tab badge text black on a "light" background and white otherwise,
  // using the YIQ brightness of the `color` package (>= 128 is light). It is NOT the highest-contrast
  // rule above, so the audit has to copy it to know what the user really sees.
  it('follows the YIQ rule of the navigator', () => {
    assert.equal(navigationBadgeText('#A52A2A'), '#FFFFFF');
    assert.equal(navigationBadgeText('#FFB4AB'), '#000000');
    assert.equal(navigationBadgeText('#FFFFFF'), '#000000');
    assert.equal(navigationBadgeText('#000000'), '#FFFFFF');
  });

  it('shows why the default badge failed: rgb(255, 59, 48) with white text is 3.55:1', () => {
    const background = '#FF3B30';
    assert.equal(navigationBadgeText(background), '#FFFFFF');
    close(contrastRatio('#FFFFFF', background), 3.55, 0.01);
    assert.ok(contrastRatio('#FFFFFF', background) < CONTRAST_MINIMUM.normalText);
  });
});
