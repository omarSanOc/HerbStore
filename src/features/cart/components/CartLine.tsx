import { StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  AppButton,
  AppSurface,
  AppText,
  RemoteImage,
  fontScaleLimits,
  radii,
  spacing,
  useAppTheme,
} from '@/design-system';
import { formatMoney } from '@/features/preferences/logic/currency';

import type { DisplayCartLine } from '../logic/cart-selectors';

type CartLineProps = Readonly<{
  item: DisplayCartLine;
  language: string;
  locked: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  onDelete: () => void;
}>;

/** Snapshot-backed line: it has enough data to remain useful after restart and while offline. */
export function CartLine({
  item,
  language,
  locked,
  onDecrement,
  onIncrement,
  onDelete,
}: CartLineProps) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const { line, unitCents, totalCents, currency } = item;
  const unitPrice = formatMoney(unitCents, currency, language);
  const lineTotal = formatMoney(totalCents, currency, language);
  const canIncrement = !locked && line.quantity < line.stock;
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (locked) return;
    if (event.nativeEvent.actionName === 'increment' && canIncrement) onIncrement();
    if (event.nativeEvent.actionName === 'decrement') onDecrement();
  };

  return (
    <AppSurface style={[styles.card, { borderColor: colors.border }]}>
      <View style={[styles.main, fontScale > 1.5 ? styles.mainLargeText : null]}>
        <RemoteImage
          aspectRatio={1}
          fallbackText={t('image.unavailable')}
          path={line.imagePath}
          style={styles.image}
        />
        <View style={styles.details}>
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
            variant="subheading">
            {line.name}
          </AppText>
          <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} tone="muted">
            {t('cart.line.unitPrice', { amount: unitPrice })}
          </AppText>
          <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} variant="label">
            {t('cart.line.subtotal', { amount: lineTotal })}
          </AppText>
        </View>
      </View>

      <View style={styles.controls}>
        <AppButton
          accessibilityHint={t('cart.line.decreaseHint')}
          accessibilityLabel={t('cart.line.decrease', { name: line.name })}
          disabled={locked}
          label="−"
          maxFontSizeMultiplier={fontScaleLimits.actionLabel}
          onPress={onDecrement}
          style={styles.step}
        />
        <View
          accessibilityActions={[
            { name: 'increment', label: t('cart.line.increaseAction') },
            { name: 'decrement', label: t('cart.line.decreaseAction') },
          ]}
          accessibilityLabel={t('cart.line.quantityLabel', { name: line.name })}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 1, max: line.stock, now: line.quantity, text: String(line.quantity) }}
          accessible
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.quantity, { borderColor: colors.controlBorder }]}>
          <AppText maxFontSizeMultiplier={fontScaleLimits.actionLabel} variant="label">
            {line.quantity}
          </AppText>
        </View>
        <AppButton
          accessibilityHint={t('cart.line.increaseHint')}
          accessibilityLabel={t('cart.line.increase', { name: line.name })}
          disabled={!canIncrement}
          label="+"
          maxFontSizeMultiplier={fontScaleLimits.actionLabel}
          onPress={onIncrement}
          style={styles.step}
        />
        <AppButton
          accessibilityHint={t('cart.line.deleteHint')}
          accessibilityLabel={t('cart.line.deleteNamed', { name: line.name })}
          disabled={locked}
          label={t('cart.line.delete')}
          maxFontSizeMultiplier={fontScaleLimits.actionLabel}
          onPress={onDelete}
          style={styles.delete}
        />
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  mainLargeText: {
    flexDirection: 'column',
  },
  image: {
    width: 88,
    flexShrink: 0,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
  },
  details: {
    flex: 1,
    gap: spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  step: {
    paddingHorizontal: spacing.sm,
  },
  quantity: {
    minWidth: 64,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  delete: {
    marginLeft: 'auto',
  },
});
