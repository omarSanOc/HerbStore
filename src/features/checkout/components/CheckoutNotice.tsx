import { StyleSheet, View } from 'react-native';

import { AppText, spacing, useAppTheme } from '@/design-system';

type CheckoutNoticeProps = Readonly<{
  /** Already translated. */
  message: string;
  /** One already translated line per affected cart line (optional). */
  details?: readonly string[];
}>;

/**
 * A message the checkout form cannot place under a field: the server refused the order for a
 * reason that is not one of the typed values (out of stock, a cart line it did not accept).
 *
 * It is ONE accessible element (`alert` + live region) whose label is the whole text, so a screen
 * reader speaks it as a unit. The screen also announces it explicitly when the outcome arrives: a
 * live region alone is not reliable on iOS for a view inserted after a network answer, and the
 * screen may leave (empty cart) before a render-time effect would run.
 *
 * Compose: a `Snackbar`/`AlertDialog` with `liveRegion`; SwiftUI: `UIAccessibility.post(.announcement)`.
 */
export function CheckoutNotice({ message, details = [] }: CheckoutNoticeProps) {
  const { colors } = useAppTheme();
  const label = [message, ...details].join(' ');
  return (
    <View accessible accessibilityRole="alert" accessibilityLabel={label} accessibilityLiveRegion="polite" style={[styles.box, { borderColor: colors.error }]}>
      <AppText variant="label">{message}</AppText>
      {details.map((line) => <AppText key={line}>{line}</AppText>)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 8, padding: spacing.md, gap: spacing.xs },
});
