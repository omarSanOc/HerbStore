/**
 * A size that follows the system font scale, never below its base: the equivalent of measuring a
 * length in `sp` instead of `dp`. The font scale only multiplies text, so any space that exists
 * BECAUSE of the text (the gap that tells two long labels apart, the height of a placeholder line
 * that stands for a line of text) must be multiplied by hand or it stays tiny beside the text.
 * A font smaller than the default changes nothing and an invalid scale is the default.
 *
 * Compose: `with(LocalDensity.current) { 8.sp.toDp() }` (or `TextUnit` in `Modifier.height`).
 * SwiftUI: `@ScaledMetric var gap = 8` (it follows Dynamic Type).
 */
export function scaleWithFont(base: number, fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? Math.max(fontScale, 1) : 1;
  return base * scale;
}
