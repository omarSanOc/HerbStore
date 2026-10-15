import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppButton, AppSurface, AppText, spacing } from '@/design-system';
import { useAppDispatch, useAppSelector, useAppStore } from '@/core/store/hooks';
import type { AttemptOutcome } from '../logic/attempt-machine';
import { initialRedirectPhase, nextRedirect, type RedirectPhase, type RedirectTarget } from '../logic/order-status-redirect';
import { checkOrderStatus } from '../store/checkout-thunks';
import { waitCancelled } from '../store/checkout-attempt-slice';

const REDIRECT_HREF = {
  checkout: '/(tabs)/(cart)/checkout',
  'order-confirmation': '/(tabs)/(cart)/order-confirmation',
} as const satisfies Record<RedirectTarget, string>;

/** The only navigation of this screen besides Cancel; the dev log makes "exactly once" observable. */
function redirect(router: ReturnType<typeof useRouter>, target: RedirectTarget, source: 'effect' | 'consult') {
  if (__DEV__) console.log(`[order-status] redirect -> ${target} (from ${source})`);
  router.replace(REDIRECT_HREF[target]);
}

export function OrderStatusScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const attempt = useAppSelector((state) => state.checkoutAttempt);
  const [remaining, setRemaining] = useState(() => attempt.remoteStatus === 'pending' ? 1 : 0);
  const [busy, setBusy] = useState(false);
  // Guards, not UI: changing them must not re-render, so they live in refs (RF-38).
  const phase = useRef<RedirectPhase>(initialRedirectPhase);
  const mounted = useRef(false);
  const status = attempt.status;
  const key = attempt.status === 'idle' ? undefined : attempt.key;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Navigation is a side effect: it runs after commit, never while rendering.
  useEffect(() => {
    const decision = nextRedirect(phase.current, { type: 'attemptObserved', status });
    phase.current = decision.phase;
    if (decision.redirect) redirect(router, decision.redirect, 'effect');
  }, [status, router]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  // No attempt: render nothing while the effect redirects (no content for a missing attempt).
  if (attempt.status === 'idle') return null;

  const consult = async () => {
    if (!key || remaining > 0 || busy) return;
    phase.current = nextRedirect(phase.current, { type: 'consultStarted' }).phase;
    setBusy(true);
    let outcome: AttemptOutcome | undefined;
    let retryAfterSeconds: number | undefined;
    try {
      const result = await dispatch(checkOrderStatus(key)).unwrap();
      outcome = result.outcome;
      if ('result' in result && result.result?.status === 'pending') retryAfterSeconds = result.result.retryAfterSeconds;
    } catch {
      // A thrown consult decides by the current attempt status instead of staying in `consulting`.
      outcome = undefined;
    }
    if (!mounted.current) {
      phase.current = nextRedirect(phase.current, { type: 'left' }).phase;
      return;
    }
    setBusy(false);
    const decision = nextRedirect(phase.current, { type: 'consultFinished', outcome, status: store.getState().checkoutAttempt.status });
    phase.current = decision.phase;
    if (decision.redirect) redirect(router, decision.redirect, 'consult');
    else if (decision.phase === 'watching' && retryAfterSeconds !== undefined) setRemaining(retryAfterSeconds);
  };
  const cancel = () => {
    phase.current = nextRedirect(phase.current, { type: 'left' }).phase;
    dispatch(waitCancelled());
    router.back();
  };
  return (
    <AppSurface level="page" style={styles.page}>
      <View style={styles.content} accessibilityLiveRegion="polite">
        <AppText accessibilityRole="header" variant="subheading">{t('checkout.status.title')}</AppText>
        <AppText>{attempt.remoteStatus === 'pending' ? t('checkout.status.pending') : t('checkout.status.unresolved')}</AppText>
        {remaining > 0 && <AppText>{t('checkout.status.wait', { seconds: remaining })}</AppText>}
        <AppButton accessibilityHint={t('checkout.status.consultHint')} disabled={remaining > 0 || busy} label={busy ? t('checkout.status.consulting') : t('checkout.status.consult')} onPress={() => void consult()} variant="primary" />
        <AppButton accessibilityHint={t('checkout.status.cancelHint')} label={t('checkout.status.cancel')} onPress={cancel} />
      </View>
    </AppSurface>
  );
}
const styles = StyleSheet.create({ page: { flex: 1 }, content: { padding: spacing.md, gap: spacing.md } });
