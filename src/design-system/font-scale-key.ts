// The key that makes a `Text` re-measure when the system text size changes (H-10 = N-4, T6c).
// Pure so `node:test` covers the rule; `font-scale-key.test.ts` explains why it exists.

/**
 * iOS: the font scale itself, so a new size is a new key and React remounts the text node, which is
 * measured again with the new size. Other platforms: no key (Android relaunches the Activity on a
 * `font_scale` change, so every view is born at the new size).
 */
export function textRemeasureKey(platform: string, fontScale: number): number | undefined {
  return platform === 'ios' ? fontScale : undefined;
}
