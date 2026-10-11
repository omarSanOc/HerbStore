/** Beyond this font scale the card stops widening (a 240 dp card is already most of a phone). */
const MAX_WIDTH_SCALE = 1.5;

/**
 * Card width for the current system font scale. The card has a fixed width so rows line up, but a
 * fixed width that suits 1x text splits a price such as "USD 12.99" mid-token at 2x (Android breaks
 * a word that does not fit). Growing the width with the font keeps tokens whole up to
 * `MAX_WIDTH_SCALE`; the height was never fixed, so wrapped lines simply make the card taller.
 */
export function getProductCardWidth(baseWidth: number, fontScale: number): number {
  const scale = Number.isFinite(fontScale) ? Math.min(Math.max(fontScale, 1), MAX_WIDTH_SCALE) : 1;
  return baseWidth * scale;
}
