import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { selectIsRehydrated } from '@/core/store/rehydration';
import { useAppSelector } from '@/core/store/hooks';
import { AppButton, AppSurface, AppText, fontScaleLimits, radii, sizes, spacing, useAppTheme } from '@/design-system';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';
import { useGoToHomeRoot } from '@/features/navigation/use-go-to-home-root';
import { selectPreferredCurrency } from '@/features/preferences/store/preferences-slice';

import { buildOrderHistoryRows, type OrderRowModel } from '../logic/order-history-view';

/**
 * "My orders": the orders confirmed on THIS installation (spec 006, RF-11, RF-12), newest first.
 * The source is the persisted `orderHistory` slice, so the list survives a restart. It says what it
 * shows ("on this installation") and promises nothing beyond that: no sync, no recovery, no address.
 *
 * Compose: a `LazyColumn` over a Room `Flow`; SwiftUI: a `List` over a SwiftData `@Query`. A plain
 * `ScrollView` is enough here (an order every few minutes at most; a virtualized list would be
 * complexity without a measured reason).
 */
export function OrderHistoryScreen() {
  const { t, i18n } = useTranslation();
  const goToHomeRoot = useGoToHomeRoot();
  const rehydrated = useAppSelector(selectIsRehydrated);
  const orders = useAppSelector((state) => state.orderHistory.orders);
  const currency = useAppSelector(selectPreferredCurrency);

  // Before the disk has answered we do not KNOW there are no orders: show nothing instead of lying.
  if (!rehydrated) return <AppSurface level="page" style={styles.page} />;

  const rows = buildOrderHistoryRows(orders, { currency, language: i18n.language });

  if (rows.length === 0) {
    return (
      <MessageScreen message={t('orders.empty.message')} title={t('orders.empty.title')}>
        <AppButton
          accessibilityHint={t('orders.empty.goHomeHint')}
          label={t('orders.empty.goHome')}
          onPress={goToHomeRoot}
          variant="primary"
        />
      </MessageScreen>
    );
  }

  return (
    <AppSurface level="page" style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.column}>
          <AppText tone="muted">{t('orders.intro')}</AppText>
          {rows.map((row) => (
            <OrderRow key={row.id} row={row} />
          ))}
        </View>
      </ScrollView>
    </AppSurface>
  );
}

/** One order as ONE accessibility element: the screen reader says it in a single phrase. */
function OrderRow({ row }: Readonly<{ row: OrderRowModel }>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const units = t('orders.row.units', { count: row.unitCount });
  const label =
    row.dateText === undefined
      ? t('orders.row.labelNoDate', { id: row.id, units, amount: row.totalText })
      : t('orders.row.label', { id: row.id, date: row.dateText, units, amount: row.totalText });

  return (
    <AppSurface accessible accessibilityLabel={label} style={[styles.card, { borderColor: colors.border }]}>
      <AppText maxFontSizeMultiplier={fontScaleLimits.sectionHeading} variant="label">
        {t('orders.row.order', { id: row.id })}
      </AppText>
      {row.dateText === undefined ? null : <AppText tone="muted">{row.dateText}</AppText>}
      <View style={styles.summary}>
        <AppText>{units}</AppText>
        <AppText variant="label">{t('orders.row.total', { amount: row.totalText })}</AppText>
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flexGrow: 1 },
  column: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
