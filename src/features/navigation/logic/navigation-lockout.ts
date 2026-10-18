/**
 * How long, after one navigation, the next one from the same screen is ignored. A double tap lands
 * ~100 ms apart (measured on device, day 5); a stack animation takes ~350 ms. 500 ms covers both and
 * is short enough that a deliberate second action (go back twice) is not noticeably blocked.
 */
export const NAVIGATION_LOCKOUT_MS = 500;

export type NavigationLockout = Readonly<{
  /** Runs `action` unless a navigation ran less than the window ago. Returns whether it ran. */
  run: (action: () => void) => boolean;
}>;

type LockoutOptions = Readonly<{
  windowMs?: number;
  /** Injected so a test controls the clock; the app uses `Date.now`. */
  now?: () => number;
}>;

/**
 * A one-screen "single tap" guard for navigation (spec 006, RF-4; M-6 and the day 5 double tap).
 *
 * Why it exists: `router.push` / `router.back` are dispatched synchronously on every press, so two
 * taps before the first transition settles ask the navigator twice. `dangerouslySingular` cannot
 * help in that window (two screens were stacked) and two `back()` calls pop two screens.
 *
 * Pure on purpose: no React, no router. The time is a parameter, so the rule is a table of cases.
 * If the clock jumps backwards (the user changes the time) the difference turns negative and the
 * action runs: a lockout must never be able to block navigation for good.
 *
 * Compose: `launchSingleTop` / a debounced `onClick`. SwiftUI: a `Button` that ignores presses
 * while `isNavigating` is true.
 */
export function createNavigationLockout({
  windowMs = NAVIGATION_LOCKOUT_MS,
  now = Date.now,
}: LockoutOptions = {}): NavigationLockout {
  let lastRunAt: number | undefined;

  return {
    run: (action) => {
      const current = now();
      if (lastRunAt !== undefined) {
        const elapsed = current - lastRunAt;
        if (elapsed >= 0 && elapsed < windowMs) return false;
      }
      lastRunAt = current;
      action();
      return true;
    },
  };
}
