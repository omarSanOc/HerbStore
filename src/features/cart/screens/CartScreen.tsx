import { useRouter } from 'expo-router';
import { memo, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppButton, AppSurface, AppText, fontScaleLimits, sizes, spacing } from '@/design-system';
import { useGoToHomeRoot } from '@/features/navigation/use-go-to-home-root';
import { NAVIGATION_LOCKOUT_MS } from '@/features/navigation/logic/navigation-lockout';
import { useNavigationLockout } from '@/features/navigation/use-navigation-lockout';
import { formatMoney } from '@/features/preferences/logic/currency';

import { CartLine } from '../components/CartLine';
import { CartRestoring } from '../components/CartRestoring';
import { EmptyCart } from '../components/EmptyCart';
import { ShippingProgress } from '../components/ShippingProgress';
import { SwipeToDelete } from '../components/SwipeToDelete';
import {
  type DisplayCartLine,
  selectDisplayCartLines,
  selectDisplaySubtotal,
  selectCanCheckout,
  selectIsCartLocked,
  selectShippingProgress,
} from '../logic/cart-selectors';
import { lineDecremented, lineIncremented, lineRemoved } from '../store/cart-slice';

type CartLineRowProps = Readonly<
  DisplayCartLine & {
    language: string;
    locked: boolean;
    /** One guard for ALL rows of the screen (a stable function: it does not break the `memo`). */
    guardRemoval: (action: () => void) => boolean;
  }
>;

/**
 * One line with its swipe-to-delete. `memo` has a MEASURED reason (T6d, `docs/evidence/day-6-
 * performance.md`): `selectDisplayCartLines` builds a new `item` object per line on every change, and
 * the callbacks are created inside `lines.map`, where the React Compiler cannot cache them; so
 * changing ONE quantity rendered every line. The row takes the pieces of the item (`line` keeps its
 * identity for the lines that did not change; the rest are primitives) and dispatches by itself, so
 * it has no function props that change on every render and an untouched line is skipped.
 *
 * Compose: a `key(productId)` item with stable parameters is skipped. SwiftUI: `Equatable` row.
 */
const CartLineRow = memo(function CartLineRow({
  line,
  unitCents,
  totalCents,
  currency,
  language,
  locked,
  guardRemoval,
}: CartLineRowProps) {
  const dispatch = useAppDispatch();
  // Every writer checks the lock before dispatch (see the cart store notes). A removal also goes
  // through the screen's guard: the list re-renders and the NEXT line moves up under the finger, so
  // a second tap ~100 ms later would delete that line too (found in the T6e spike on iOS with two
  // taps 50 ms apart; RF-25: one line, never the one that takes its place).
  const remove = () => {
    if (!locked) guardRemoval(() => dispatch(lineRemoved(line.productId)));
  };
  // "−" on the LAST unit also removes the line (cart.ts `decrementLine`), so it has the same double
  // tap problem and goes through the same guard. With more units it only lowers the quantity and is
  // never guarded: two fast taps on a line of 3 must lower two units (T6f).
  const decrement = () => {
    if (locked) return;
    if (line.quantity <= 1) guardRemoval(() => dispatch(lineDecremented(line.productId)));
    else dispatch(lineDecremented(line.productId));
  };
  return (
    <SwipeToDelete disabled={locked} onDelete={remove}>
      <CartLine
        item={{ line, unitCents, totalCents, currency }}
        language={language}
        locked={locked}
        onDecrement={decrement}
        onDelete={remove}
        onIncrement={() => {
          if (!locked) dispatch(lineIncremented(line.productId));
        }}
      />
    </SwipeToDelete>
  );
});

/** Persisted cart UI. All sums are selectors; the screen stores no duplicate totals. */
export function CartScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  // RF-37: `dismissTo('/')` is POP_TO, which the Tabs navigator ignores from the Cart tab (H-T8-2).
  const goToHomeRoot = useGoToHomeRoot();
  // A fast double tap on "Continue" would push the checkout twice (spec 006, T3b).
  const navigate = useNavigationLockout();
  // Separate instance on purpose: tapping "Delete" must not block "Continue" and vice versa.
  // Keep the removal window as a synchronous ref rather than deriving it from the row that was
  // pressed. A native double tap can deliver its second press before React commits the list update;
  // the ref therefore survives the row unmount/replacement and protects the line that moves under
  // the finger as well.
  const removalLocked = useRef(false);
  const guardRemoval = useCallback((action: () => void) => {
    if (removalLocked.current) return false;
    removalLocked.current = true;
    action();
    setTimeout(() => {
      removalLocked.current = false;
    }, NAVIGATION_LOCKOUT_MS);
    return true;
  }, []);
  const locked = useAppSelector(selectIsCartLocked);
  const attempt = useAppSelector((state) => state.checkoutAttempt);
  const canCheckout = useAppSelector(selectCanCheckout);
  const lines = useAppSelector(selectDisplayCartLines);
  const subtotal = useAppSelector(selectDisplaySubtotal);
  const shipping = useAppSelector(selectShippingProgress);

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
        <EmptyCart onGoHome={goToHomeRoot} />
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
            {lines.map((item) => (
              <CartLineRow
                key={item.line.productId}
                guardRemoval={guardRemoval}
                language={i18n.language}
                locked={locked}
                {...item}
              />
            ))}
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
            // Enabled: what it does. (It used to carry the empty cart's "add a product" hint.)
            accessibilityHint={t(canCheckout ? 'cart.checkout.hint' : 'cart.checkout.emptyHint')}
            disabled={!canCheckout}
            label={t('cart.checkout.label')}
            onPress={() => navigate(() => router.push('/(tabs)/(cart)/checkout'))}
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
