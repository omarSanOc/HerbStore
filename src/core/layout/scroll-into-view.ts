type RevealInput = {
  /** Top of the target, in the coordinates of the scroll CONTENT (not of the screen). */
  targetTop: number;
  targetHeight: number;
  /** How far the content is scrolled now. */
  scrollOffset: number;
  /** Height of the visible part of the scroll view (without any bar that sits over or under it). */
  viewportHeight: number;
  /** Breathing room kept between the target and the edge it was scrolled to. */
  margin: number;
};

/**
 * The scroll offset that makes a target fully visible with the least movement, or `undefined` when it
 * already is: `scrollIntoView({ block: 'nearest' })` of the web. A target above the viewport is
 * brought to its top edge, one below it to its bottom edge, and one taller than the viewport is
 * aligned by its top, so its beginning is what the person reads first. Never negative.
 *
 * Why it exists: a line that APPEARS after an action (the failed-share message) lands wherever the
 * layout puts it, which at a large font can be under the bar pinned over the bottom of the screen, and
 * nobody is looking there. Compose: `BringIntoViewRequester.bringIntoView()`. SwiftUI:
 * `ScrollViewReader.scrollTo(id, anchor:)`.
 */
export function getScrollOffsetToReveal({
  targetTop,
  targetHeight,
  scrollOffset,
  viewportHeight,
  margin,
}: RevealInput): number | undefined {
  if (![targetTop, targetHeight, scrollOffset, viewportHeight, margin].every(Number.isFinite)) {
    return undefined;
  }

  const top = Math.max(0, targetTop - margin);
  const bottom = targetTop + targetHeight + margin;

  if (targetHeight + 2 * margin >= viewportHeight) {
    return top === scrollOffset ? undefined : top;
  }
  if (top < scrollOffset) {
    return top;
  }
  if (bottom > scrollOffset + viewportHeight) {
    return bottom - viewportHeight;
  }

  return undefined;
}
