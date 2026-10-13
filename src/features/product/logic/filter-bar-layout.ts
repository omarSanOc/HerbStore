type FilterItemWidthInput = {
  /** Width of the window, in dp/pt. */
  windowWidth: number;
  /** Space between the window edge and the filter row, on EACH side. */
  horizontalInset: number;
  /** Floor of the result: the minimum touch target. */
  minimumWidth: number;
};

/**
 * The widest an item of the filter row (sort button or chip) may be: exactly the width the row
 * shows. The row is a HORIZONTAL scroll view, whose content has no width limit, so a `Text`
 * inside never wraps by itself: at a large font a long label becomes one very long line and is cut
 * by the viewport. Capping each item at one viewport makes the label wrap between words instead.
 * An invalid width falls back to the minimum.
 */
export function getFilterItemMaxWidth({
  windowWidth,
  horizontalInset,
  minimumWidth,
}: FilterItemWidthInput): number {
  if (!Number.isFinite(windowWidth)) {
    return minimumWidth;
  }

  return Math.max(minimumWidth, windowWidth - 2 * horizontalInset);
}
