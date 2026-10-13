import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppButton, AppSurface, AppText, fontScaleLimits, sizes, spacing } from '@/design-system';
import { formatMoney } from '@/features/preferences/logic/currency';

import { CartLine } from '../components/CartLine';
import { CartRestoring } from '../components/CartRestoring';
import { EmptyCart } from '../components/EmptyCart';
import { ShippingProgress } from '../components/ShippingProgress';
import { SwipeToDelete } from '../components/SwipeToDelete';
import {
  selectDisplayCartLines,
  selectDisplaySubtotal,
  selectCanCheckout,
  selectIsCartLocked,
  selectShippingProgress,
} from '../logic/cart-selectors';
import { lineDecremented, lineIncremented, lineRemoved } from '../store/cart-slice';

/** Persisted cart UI. All sums are selectors; the screen stores no duplicate totals. */
export function CartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const locked = useAppSelector(selectIsCartLocked);
  const attempt = useAppSelector((state) => state.checkoutAttempt);
  const canCheckout = useAppSelector(selectCanCheckout);
  const lines = useAppSelector(selectDisplayCartLines);
  const subtotal = useAppSelector(selectDisplaySubtotal);
  const shipping = useAppSelector(selectShippingProgress);

  // Every writer checks the lock before dispatch. T8 can extend the selector without changing UI.
  const changeLine = (productId: string, change: 'increment' | 'decrement' | 'remove') => {
    if (locked) return;
    if (change === 'increment') dispatch(lineIncremented(productId));
    if (change === 'decrement') dispatch(lineDecremented(productId));
    if (change === 'remove') dispatch(lineRemoved(productId));
  };

  if (locked) {
    return (
      <AppSurface level="page" style={styles.page}>
        {attempt.status === 'idle' ? <CartRestoring /> : (
          <View style={styles.lockedNotice} accessibilityLiveRegion="polite">
            <AppText accessibilityRole="header" variant="subheading">{t('cart.unresolved.title')}</AppText>
            <AppText>{t('cart.unresolved.message')}</AppText>
            <AppButton accessibilityHint={t('cart.unresolved.reopenHint')} label={t('cart.unresolved.reopen')} onPress={() => router.push('/(tabs)/(cart)/order-status')} variant="primary" />
          </View>
        )}
      </AppSurface>
    );
  }

  if (lines.length === 0) {
    return (
      <AppSurface level="page" style={styles.page}>
        <EmptyCart onGoHome={() => router.dismissTo('/')} />
      </AppSurface>
    );
  }

  const subtotalText = formatMoney(subtotal.cents, subtotal.currency, i18n.language);

  return (
    <AppSurface level="page" style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.column}>
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.sectionHeading}
            variant="subheading">
            {t('cart.linesTitle', { count: lines.length })}
          </AppText>
          <View style={styles.lines}>
            {lines.map((item) => {
              const remove = () => changeLine(item.line.productId, 'remove');
              return (
                <SwipeToDelete disabled={locked} key={item.line.productId} onDelete={remove}>
                  <CartLine
                    item={item}
                    language={i18n.language}
                    locked={locked}
                    onDecrement={() => changeLine(item.line.productId, 'decrement')}
                    onDelete={remove}
                    onIncrement={() => changeLine(item.line.productId, 'increment')}
                  />
                </SwipeToDelete>
              );
            })}
          </View>
          <ShippingProgress language={i18n.language} progress={shipping} />
          <View accessible accessibilityLabel={t('cart.subtotalSpoken', { amount: subtotalText })} style={styles.subtotal}>
            <AppText maxFontSizeMultiplier={fontScaleLimits.sectionHeading} variant="subheading">
              {t('cart.subtotal')}
            </AppText>
            <AppText maxFontSizeMultiplier={fontScaleLimits.sectionHeading} variant="subheading">
              {subtotalText}
            </AppText>
          </View>
          <AppButton
            accessibilityHint={t('cart.checkout.emptyHint')}
            disabled={!canCheckout}
            label={t('cart.checkout.label')}
            onPress={() => router.push('/(tabs)/(cart)/checkout')}
            variant="primary"
          />
        </View>
      </ScrollView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  column: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  lockedNotice: { padding: spacing.md, gap: spacing.md },
  lines: {
    gap: spacing.md,
  },
  subtotal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
