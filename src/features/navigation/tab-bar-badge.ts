import type { TextStyle } from 'react-native';

/**
 * Style for the tab bar badge (`tabBarBadgeStyle`), so that "99+" is drawn complete.
 *
 * Why the default badge truncated it to "9…": the navigator draws the badge as a one-line `Text`
 * (`numberOfLines={1}`) positioned absolutely inside the 31 dp icon wrapper with only `end: -3`.
 * Yoga caps an absolute child that has no explicit width at the wrapper's width, whatever its
 * offsets are (the truncated text measured exactly 31 dp on Android). The default look is 14 sp text with 4 dp of horizontal padding,
 * which needs about 33 dp for "99+" (and it also scales with the system text size), so the text
 * ellipsizes. "99" needs about 25 dp and fits, which is why 99 looked right and 100 did not.
 *
 * The fix keeps the built-in `Badge` (colour, appear/disappear animation and contrast) and only
 * changes its style:
 * - `fontSize: 12` and `paddingHorizontal: 3` make "99+" need about 27 dp (measured), below the 31 dp limit.
 *   The built-in badge draws its text in a fixed-height pill, so a bigger font would not fit either.
 * - The badge is anchored by its START edge (`start` instead of `end`), so a wider badge grows
 *   outwards, away from the icon, instead of sliding over it. `end` must be unset: with both set,
 *   Yoga pins the width to `31 - start - end` and every badge would become the same pill.
 *
 * It is used together with `tabBarAllowFontScaling: false` (see the tabs layout): the built-in
 * `Badge` cannot take `maxFontSizeMultiplier`, and a fixed-height pill that scaled with the system
 * text size would truncate even "99" from about 1.4x. The count is still available to screen
 * readers through the tab's accessibility label ("Carrito, 100 artículos").
 */
export const tabBarBadgeStyle: TextStyle = {
  // Leading edge of the badge, inside the 31 dp icon wrapper (the icon is 25 dp and centered):
  // it overlaps only the icon's top-right corner, and a wider badge grows to the outside.
  start: 21,
  top: -4,
  end: undefined,
  fontSize: 12,
  paddingHorizontal: 3,
};
