// WCAG 2.x color contrast (RF-13, spec 006 T6c). Pure: no React Native, so `node:test` can run it and
// the audit in `contrast-audit.test.ts` can judge the real palettes without a device.
//
// Android: `androidx.core.graphics.ColorUtils.calculateContrast(fg, bg)` is this same formula;
// Compose has no built-in check. iOS: the Accessibility Inspector reports this ratio, and
// `UIColor` has no public API for it.

export type Rgb = Readonly<{ r: number; g: number; b: number }>;

/**
 * The AA minimums of WCAG 2.x (SC 1.4.3 for text, SC 1.4.11 for components and graphics).
 * `uiComponent` covers the boundary of a control that is needed to find it (a field border, a chip
 * outline), icons that carry information and the parts of a graphic needed to understand it.
 */
export const CONTRAST_MINIMUM = {
  normalText: 4.5,
  largeText: 3,
  uiComponent: 3,
} as const;

export type ContrastKind = keyof typeof CONTRAST_MINIMUM;

/** An opaque `#RGB` or `#RRGGBB` color. Anything else throws: a `NaN` would pass every `>=`. */
export function parseHexColor(hex: string): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) {
    throw new RangeError(`Not an opaque hex color: "${hex}"`);
  }

  const digits = match[1] as string;
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  const value = Number.parseInt(full, 16);

  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function linearChannel(channel: number): number {
  const srgb = channel / 255;
  // 0.04045 is the corrected sRGB breakpoint; WCAG 2.x prints 0.03928. For 8-bit channels both give
  // the same ratio to the last printed digit.
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** Contrast ratio, 1 to 21, symmetric: the order of the two colors does not matter. */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * WCAG "large text": at least 18 pt, or at least 14 pt and bold. Bold is weight 700 or more:
 * a semi-bold 600 label is NOT bold for this rule, so it keeps the stricter 4.5:1.
 */
export function classifyText(style: Readonly<{ fontSize: number; fontWeight: string }>): 'normalText' | 'largeText' {
  const bold = style.fontWeight === 'bold' || Number(style.fontWeight) >= 700;
  return style.fontSize >= 18 || (style.fontSize >= 14 && bold) ? 'largeText' : 'normalText';
}

/**
 * White or black, whichever contrasts more with `background`. The native accent button of
 * DeviceInsights (Kotlin `contrastingTextColor`, Swift equivalent) uses this rule, and it always
 * reaches 4.58:1 or more, whatever the background.
 */
export function highestContrastText(background: string): '#FFFFFF' | '#000000' {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#000000', background)
    ? '#FFFFFF'
    : '#000000';
}

function toHexChannel(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0').toUpperCase();
}

/** `foreground` drawn at `alpha` (0-1) over `background`, as an opaque hex color. */
export function blendOver(foreground: string, background: string, alpha: number): string {
  const f = parseHexColor(foreground);
  const b = parseHexColor(background);
  const mix = (front: number, back: number) => front * alpha + back * (1 - alpha);

  return `#${toHexChannel(mix(f.r, b.r))}${toHexChannel(mix(f.g, b.g))}${toHexChannel(mix(f.b, b.b))}`;
}

/**
 * The text color the navigator's `Badge` draws on a background: black when the background is "light"
 * and white otherwise, with the YIQ brightness (>= 128 is light) of the `color` package. It is NOT
 * the highest-contrast rule: on `rgb(255, 59, 48)` it picks white, which is only 3.55:1.
 */
export function navigationBadgeText(background: string): '#FFFFFF' | '#000000' {
  const { r, g, b } = parseHexColor(background);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}
