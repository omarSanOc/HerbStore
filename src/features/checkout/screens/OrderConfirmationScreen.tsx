import { Linking, ScrollView, StyleSheet, type Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppButton, AppSurface, AppText, fontScaleLimits, spacing } from '@/design-system';
import { useFocusOnMount } from '@/core/accessibility/use-focus-on-mount';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { buildNotificationNotice } from '@/features/checkout/logic/order-notification-notice';
import { notificationRetryRequested } from '@/features/orders/store/order-history-slice';

export function OrderConfirmationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const order = useAppSelector((state) => state.orderHistory.orders.at(-1));
  const notification = useAppSelector((state) => order ? state.orderHistory.notifications.records[order.id] : undefined);
  const dispatch = useAppDispatch();
  // The screen replaces the checkout, whose focused button is gone: say where the reader goes.
  const titleRef = useFocusOnMount<Text>();
  // RF-39: text and actions come from a pure function; an absent record remains pending.
  const notice = buildNotificationNotice(notification);
  const retryNotification = () => {
    if (!order || !notice || notice.retrying) return;
    dispatch(notificationRetryRequested(order.id));
  };
  // Scrollable: with large text the notification notice plus its two actions push "Volver al carrito" under the tab bar.
  return <AppSurface level="page" style={styles.page}><ScrollView><View style={styles.content} accessibilityLiveRegion="polite">
    <AppText ref={titleRef} accessibilityRole="header" variant="subheading">{t('checkout.confirmation.title')}</AppText>
    <AppText>{order ? t('checkout.confirmation.order', { id: order.id }) : t('checkout.confirmation.message')}</AppText>
    {order?.items.map((item: { productId: string; quantity: number }) => <AppText key={item.productId}>{t('checkout.confirmation.line', { count: item.quantity })}</AppText>)}
    {notice ? <>
      <AppText accessibilityLiveRegion="polite">{t(notice.messageKey)}</AppText>
      {notice.showSettings ? (
        // Capped (H-T8-6): "notificaciones" is one 14-letter word and was split in the middle at iOS AX5.
        <AppButton label={t('checkout.confirmation.notificationSettings')} maxFontSizeMultiplier={fontScaleLimits.actionLabel} onPress={() => void Linking.openSettings()} accessibilityHint={t('checkout.confirmation.notificationSettingsHint')} />
      ) : null}
      {notice.showRetry ? (
        <AppButton label={notice.retrying ? t('checkout.confirmation.notificationRetrying') : t('checkout.confirmation.notificationRetry')} maxFontSizeMultiplier={fontScaleLimits.actionLabel} onPress={retryNotification} disabled={notice.retrying} accessibilityHint={t('checkout.confirmation.notificationRetryHint')} />
      ) : null}
    </> : null}
    <AppButton accessibilityHint={t('checkout.confirmation.doneHint')} label={t('checkout.confirmation.done')} onPress={() => router.dismissTo('/(tabs)/(cart)/cart')} variant="primary" />
  </View></ScrollView></AppSurface>;
}
const styles = StyleSheet.create({ page: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md } });
