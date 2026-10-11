/**
 * Pure rules of the banner pager: which presentation a count gets, how a scroll offset maps to a
 * banner and back, how the manual controls step, and the numbers of the "Banner n of N" label.
 * No React, no React Native: the component reads events and applies these answers.
 *
 * Indexes are 0-based inside the code; only `getBannerPosition` produces the 1-based numbers a
 * person reads.
 */

/** `hidden`: draw nothing; `single`: draw the banner alone; `paged`: swipe, dots and step buttons. */
export type CarouselMode = 'hidden' | 'single' | 'paged';

export type BannerStep = -1 | 1;

export function getCarouselMode(count: number): CarouselMode {
  if (!(count >= 1)) {
    return 'hidden';
  }
  return count === 1 ? 'single' : 'paged';
}

/** Keeps `index` inside `0..count-1`; anything that is not a finite number points at the first. */
export function clampBannerIndex(index: number, count: number): number {
  if (!Number.isFinite(index) || !(count >= 1)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(index), 0), Math.trunc(count) - 1);
}

/**
 * Banner shown once a swipe settles: the nearest page of the scroll offset. Rounding (not
 * flooring) tolerates the sub-pixel remainders of fractional widths, and clamping absorbs the iOS
 * bounce. With no measured width there is nothing to divide by, so it stays on the first banner.
 */
export function indexFromOffset(offset: number, pageWidth: number, count: number): number {
  if (!Number.isFinite(offset) || !(pageWidth > 0)) {
    return 0;
  }
  return clampBannerIndex(Math.round(offset / pageWidth), count);
}

/** Scroll offset that shows `index` exactly; the inverse of `indexFromOffset`. */
export function offsetForIndex(index: number, pageWidth: number, count: number): number {
  if (!(pageWidth > 0)) {
    return 0;
  }
  return clampBannerIndex(index, count) * pageWidth;
}

/** One banner forward or backward, bounded at both ends (the manual controls do not wrap). */
export function stepBannerIndex(index: number, count: number, step: BannerStep): number {
  return clampBannerIndex(clampBannerIndex(index, count) + step, count);
}

export function canStepBanner(index: number, count: number, step: BannerStep): boolean {
  return stepBannerIndex(index, count, step) !== clampBannerIndex(index, count);
}

/** The numbers for "Banner {{current}} of {{total}}"; the text itself comes from i18n. */
export function getBannerPosition(
  index: number,
  count: number,
): Readonly<{ current: number; total: number }> {
  return { current: clampBannerIndex(index, count) + 1, total: Math.max(Math.trunc(count), 0) };
}
