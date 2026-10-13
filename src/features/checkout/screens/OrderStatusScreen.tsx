import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppButton, AppSurface, AppText, spacing } from '@/design-system';
import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { checkOrderStatus } from '../store/checkout-thunks';
import { waitCancelled } from '../store/checkout-attempt-slice';

export function OrderStatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const attempt = useAppSelector((state) => state.checkoutAttempt);
  const [remaining, setRemaining] = useState(() => attempt.remoteStatus === 'pending' ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const key = attempt.status === 'idle' ? undefined : attempt.key;

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  if (attempt.status === 'idle') {
    router.replace('/(tabs)/(cart)/checkout');
    return null;
  }
  const consult = async () => {
    if (!key || remaining > 0 || busy) return;
    setBusy(true);
    const result = await dispatch(checkOrderStatus(key)).unwrap();
    setBusy(false);
    if (result.outcome === 'confirmed') router.replace('/(tabs)/(cart)/order-confirmation');
    else if ('result' in result && result.result?.status === 'pending') setRemaining(result.result.retryAfterSeconds);
  };
  return (
    <AppSurface level="page" style={styles.page}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        <AppText accessibilityRole="header" variant="subheading">{t('checkout.status.title')}</AppText>
        <AppText>{attempt.remoteStatus === 'pending' ? t('checkout.status.pending') : t('checkout.status.unresolved')}</AppText>
        {remaining > 0 && <AppText>{t('checkout.status.wait', { seconds: remaining })}</AppText>}
        <AppButton accessibilityHint={t('checkout.status.consultHint')} disabled={remaining > 0 || busy} label={busy ? t('checkout.status.consulting') : t('checkout.status.consult')} onPress={() => void consult()} variant="primary" />
        <AppButton accessibilityHint={t('checkout.status.cancelHint')} label={t('checkout.status.cancel')} onPress={() => { dispatch(waitCancelled()); router.back(); }} />
      </View>
    </AppSurface>
  );
}
const styles = StyleSheet.create({ page: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md } });
