import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, fontScaleLimits, sizes, spacing, useAppTheme } from '@/design-system';

type StickyAddBarProps = {
  /** The chosen quantity times the unit price, already formatted in the preferred currency. */
  total: string;
  /** The product has no units left: the action is replaced by a disabled "Out of stock". */
  soldOut: boolean;
  locked: boolean;
  onAdd: () => void;
  onHeightChange: (height: number) => void;
};

/**
 * The purchase bar pinned under the scroll content: the total for the chosen quantity on the left,
 * the main action on the right. It is a SIBLING of the `ScrollView`, not a child, so it never
 * scrolls away. It wraps onto two rows when the text is large, instead of clipping, and its text
 * scales only up to `fontScaleLimits.purchaseBar`: a pinned bar that grew with the system font
 * without limit would take most of the screen and leave nothing to scroll (measured at iOS AX5).
 *
 * It needs no bottom safe-area inset: the screen lives inside the tab navigator and the tab bar
 * sits under it (and already covers the home indicator), so padding by the device inset would
 * count that space twice.
 *
 * Compose: `Scaffold(bottomBar = { BottomAppBar { ... } })`; SwiftUI: `.safeAreaInset(edge: .bottom)`.
 */
export function StickyAddBar({
  total,
  soldOut,
  locked,
  onAdd,
  onHeightChange,
}: Readonly<StickyAddBarProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.content}>
        {soldOut ? null : (
          // One element: the screen reader says "Total: $833.70" instead of two separate stops.
          <View
            accessibilityLabel={t('product.bar.totalSpoken', { total })}
            accessible
            style={styles.total}>
            <AppText maxFontSizeMultiplier={fontScaleLimits.purchaseBar} tone="muted">
              {t('product.bar.total')}
            </AppText>
            <AppText maxFontSizeMultiplier={fontScaleLimits.purchaseBar} variant="subheading">
              {total}
            </AppText>
          </View>
        )}
        <AppButton
          accessibilityHint={
            soldOut
              ? t('product.bar.soldOutHint')
              : locked
                ? t('product.bar.restoringHint')
                : t('product.bar.addHint')
          }
          disabled={soldOut || locked}
          label={
            soldOut
              ? t('product.bar.soldOut')
              : locked
                ? t('product.bar.restoring')
                : t('product.bar.add')
          }
          maxFontSizeMultiplier={fontScaleLimits.purchaseBar}
          onPress={onAdd}
          style={[styles.action, soldOut || locked ? styles.soldOut : null]}
          variant={soldOut || locked ? 'default' : 'primary'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    padding: spacing.md,
  },
  total: {
    flexShrink: 1,
  },
  action: {
    flexGrow: 1,
  },
  // A disabled `AppButton` keeps its look; dimming says "unavailable" besides the label.
  soldOut: {
    opacity: 0.6,
  },
});
