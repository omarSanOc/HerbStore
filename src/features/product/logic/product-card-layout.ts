/** Beyond this font scale the card stops widening (a 240 dp card is already most of a phone). */
const MAX_WIDTH_SCALE = 1.5;

/** Up to this font scale the grid keeps the two columns RF-9 asks for. */
const MAX_TWO_COLUMN_SCALE = 1.5;

/**
 * Columns of the category grid for the current system font scale. Two columns, as the spec says,
 * while a half-width cell (about 150 dp on a 360 dp phone) still holds a price and a word of the
 * name; beyond the same 1.5x that stops the Home card from widening, one column keeps the card
 * readable instead of breaking words or prices in the middle (RNF-2). An invalid scale is the
 * default of two.
 */
export function getGridColumnCount(fontScale: number): 1 | 2 {
  return Number.isFinite(fontScale) && fontScale > MAX_TWO_COLUMN_SCALE ? 1 : 2;
}

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
