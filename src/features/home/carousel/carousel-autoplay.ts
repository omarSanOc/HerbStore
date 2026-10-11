import { clampBannerIndex } from './banner-pager.ts';

/** RF-12: the carousel advances after 5 seconds of nothing happening. */
export const AUTOPLAY_INTERVAL_MS = 5000;

/** Everything the autoplay rule looks at; each field is one reason to pause. */
export type AutoplayConditions = Readonly<{
  bannerCount: number;
  /** The Home screen is the focused route of the focused tab (no pushed product, no modal). */
  isFocused: boolean;
  /** The app is in the foreground (not `background` nor `inactive`). */
  isAppActive: boolean;
  /** The banner row is inside the vertical viewport of Home's list. */
  isRowVisible: boolean;
  /** The system asks for less motion: the carousel stays manual (RNF-2). */
  reducedMotion: boolean;
  /** A finger is on the carousel or dragging it. */
  isInteracting: boolean;
}>;

/**
 * Should the carousel be counting down to the next banner right now? Pure: the hook turns the
 * answer into a timer that exists only while it is `true`, so every way of coming back to `true`
 * (finger lifted, app active again, row visible again, tab focused again) starts a full wait.
 */
export function shouldAutoplay(conditions: AutoplayConditions): boolean {
  const { bannerCount, isFocused, isAppActive, isRowVisible, reducedMotion, isInteracting } =
    conditions;

  return (
    bannerCount >= 2 &&
    isFocused &&
    isAppActive &&
    isRowVisible &&
    !reducedMotion &&
    !isInteracting
  );
}

/**
 * Banner autoplay moves to: one forward, wrapping from the last to the first. Unlike the manual
 * step buttons (`stepBannerIndex`, bounded at both ends), the automatic loop never gets stuck.
 */
export function nextBannerIndex(index: number, count: number): number {
  if (!(count >= 2)) {
    return 0;
  }
  const current = clampBannerIndex(index, count);
  return current + 1 < count ? current + 1 : 0;
}
