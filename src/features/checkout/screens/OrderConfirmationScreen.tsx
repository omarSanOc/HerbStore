import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppButton, AppSurface, AppText, spacing } from '@/design-system';
import { useAppSelector } from '@/core/store/hooks';

export function OrderConfirmationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const order = useAppSelector((state) => state.orderHistory.orders.at(-1));
  return <AppSurface level="page" style={styles.page}><View style={styles.content} accessibilityLiveRegion="polite">
    <AppText accessibilityRole="header" variant="subheading">{t('checkout.confirmation.title')}</AppText>
    <AppText>{order ? t('checkout.confirmation.order', { id: order.id }) : t('checkout.confirmation.message')}</AppText>
    {order?.items.map((item: { productId: string; quantity: number }) => <AppText key={item.productId}>{t('checkout.confirmation.line', { quantity: item.quantity })}</AppText>)}
    <AppButton accessibilityHint={t('checkout.confirmation.doneHint')} label={t('checkout.confirmation.done')} onPress={() => router.dismissTo('/(tabs)/(cart)/cart')} variant="primary" />
  </View></AppSurface>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md } });
