// The quantity a person picks on the product detail (spec 004, RF-6). Pure: no React Native, so
// `test:logic` runs it. The quantity is LOCAL state of the detail screen (it dies with the screen);
// only what is added to the cart (T4) reaches Redux.

/** One unit is the least that can be chosen. */
export const MIN_QUANTITY = 1;

export type QuantityChoice = Readonly<{
  /** The quantity to show and to buy: `1 <= quantity <= stock`, or 0 when nothing can be chosen. */
  quantity: number;
  /**
   * The request went PAST the stock (or the product is sold out) and was cut to the maximum, so the
   * screen must say so. Reaching exactly the stock is not a limit; going below one is not either.
   */
  limited: boolean;
}>;

/** A stock the rules can use: a whole number of units >= 0. Anything else counts as sold out. */
function usableStock(stock: number): number {
  return Number.isFinite(stock) && stock >= 1 ? Math.floor(stock) : 0;
}

/**
 * Keeps a requested quantity inside `[1, stock]` (RF-6). Above the stock it keeps the maximum and
 * flags `limited`; below one it returns one; with no usable stock there is nothing to choose, so
 * the quantity is 0 and `limited` is true (same answer as `addLine` of the cart for a sold out
 * product). Something that is not a whole number is truncated, and `NaN` becomes one.
 */
export function clampQuantity(requested: number, stock: number): QuantityChoice {
  const maximum = usableStock(stock);
  if (maximum === 0) {
    return { quantity: 0, limited: true };
  }

  const wanted = Number.isNaN(requested) ? MIN_QUANTITY : Math.trunc(requested);

  return {
    quantity: Math.min(Math.max(wanted, MIN_QUANTITY), maximum),
    limited: wanted > maximum,
  };
}

/**
 * One unit up (`1`) or down (`-1`) from the quantity on screen. The starting point is first brought
 * inside the range, so after the stock dropped under the selection a step continues from the
 * maximum the stock allows, never from a number the screen is not showing.
 */
export function stepQuantity(current: number, step: 1 | -1, stock: number): QuantityChoice {
  const { quantity } = clampQuantity(current, stock);

  return clampQuantity(quantity + step, stock);
}
