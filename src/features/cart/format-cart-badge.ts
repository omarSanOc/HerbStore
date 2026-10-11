/** Largest count shown literally; anything above is capped as "99+". */
const MAX_VISIBLE_BADGE = 99;

/**
 * Maps a cart unit count to the value React Navigation expects for `tabBarBadge`.
 * `undefined` hides the badge: `0` would render a visible "0" because the tab bar
 * only checks `badge != null`.
 */
export function getCartBadge(count: number): number | string | undefined {
  if (!Number.isFinite(count)) {
    return undefined;
  }

  const units = Math.trunc(count);

  if (units <= 0) {
    return undefined;
  }

  return units > MAX_VISIBLE_BADGE ? `${MAX_VISIBLE_BADGE}+` : units;
}
