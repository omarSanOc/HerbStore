import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toApiError } from '@/core/api/api-error';
import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppButton, AppSurface, AppText, fontScaleLimits, radii, spacing, useAppTheme } from '@/design-system';
import type { CurrencyCode } from '@/features/product/contracts/catalog-product';

import { useCreateOrderMutation } from '../data/orders-api';
import {
  MAX_DEV_REPOSTS,
  buildDevOrderRequest,
  createDevIdempotencyKey,
  nextDevOrderStep,
} from '../logic/dev-order';

type OrderDevControlsProps = {
  productId: string;
  currency: CurrencyCode;
};

/** What the status line says. `repost` counts the re-POSTs already announced (1..MAX_DEV_REPOSTS). */
type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'pending'; seconds: number; repost: number }
  | { kind: 'confirmed'; orderId: string }
  | { kind: 'still-pending' }
  | { kind: 'error'; reason: 'network' | 'http' | 'other'; status?: number };

/**
 * DEV-ONLY control (RF-7): sends a fictitious order for the product on screen so the invalidation
 * by tags can be seen in the logs. It is rendered ONLY under `__DEV__` (see its single use in
 * `ProductPlaceholderScreen`) and is removed on Day 4 (H-4), when the real product page and the
 * checkout replace both.
 *
 * Protocol of one press (one ATTEMPT):
 * 1. A NEW Idempotency-Key is created, once. The body is built once too.
 * 2. POST. A failure (network, 4xx, 5xx, timeout, invalid) ends the attempt: 0 automatic retries (P2),
 *    the user decides by pressing again, which starts a NEW attempt with a new key.
 * 3. A 202 `pending` is not a failure: the SAME request (same key, same body) is repeated after
 *    `retryAfterSeconds`, up to 3 times, until a 200 `confirmed`. Only the 200 invalidates tags.
 * 4. At the end the mutation is `reset()`: RTK keeps the last result (`status`/`data`) of the mutation until then.
 *    (The arguments are not stored in `api.mutations` in RTK 2.13; they only travel in the action's `meta.arg`.)
 *
 * Compose/Swift: it is a `ViewModel`/`@Observable` action that sends the same idempotent request
 * again while the server says "pending"; here it lives in the component because it is a throwaway.
 */
export function OrderDevControls({ productId, currency }: Readonly<OrderDevControlsProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotionEnabled = useReducedMotionPreference();
  const [createOrder, { reset }] = useCreateOrderMutation();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  // Bumped on unmount: a run that wakes up afterwards stops instead of touching a dead screen.
  const mountToken = useRef(0);

  useEffect(() => {
    const token = mountToken;
    return () => {
      token.current += 1;
    };
  }, []);

  const busy = phase.kind === 'sending' || phase.kind === 'pending';

  const describe = (next: Phase): string => {
    switch (next.kind) {
      case 'idle':
        return '';
      case 'sending':
        return t('orderDev.sending');
      case 'pending':
        return t('orderDev.pending', {
          seconds: next.seconds,
          attempt: next.repost,
          max: MAX_DEV_REPOSTS,
        });
      case 'confirmed':
        return t('orderDev.confirmed', { id: next.orderId.slice(0, 8) });
      case 'still-pending':
        return t('orderDev.stillPending', { max: MAX_DEV_REPOSTS });
      case 'error':
        return next.reason === 'network'
          ? t('orderDev.errorNetwork')
          : next.reason === 'http'
            ? t('orderDev.errorHttp', { status: next.status })
            : t('orderDev.errorOther');
    }
  };

  const show = (next: Phase) => {
    setPhase(next);
    // Android speaks the live region below by itself; iOS has no live regions, so it is announced.
    if (Platform.OS === 'ios' && next.kind !== 'idle') {
      AccessibilityInfo.announceForAccessibility(describe(next));
    }
  };

  const run = async () => {
    const token = mountToken.current;
    const alive = () => mountToken.current === token;
    // One key and one body per attempt, reused by every re-POST.
    const arg = {
      idempotencyKey: createDevIdempotencyKey(Date.now(), Math.random()),
      request: buildDevOrderRequest(productId, currency),
    };

    try {
      for (let repostsDone = 0; ; repostsDone += 1) {
        if (alive()) {
          show({ kind: 'sending' });
        }
        const response = await createOrder(arg);
        if (!alive()) {
          return;
        }

        if ('error' in response) {
          const error = toApiError(response.error);
          show({
            kind: 'error',
            reason:
              error?.kind === 'network' ? 'network' : error?.kind === 'http' ? 'http' : 'other',
            ...(error?.kind === 'http' ? { status: error.status } : {}),
          });
          return;
        }

        const step = nextDevOrderStep(response.data, repostsDone);
        if (step.kind === 'done' && response.data.status === 'confirmed') {
          show({ kind: 'confirmed', orderId: response.data.orderId });
          return;
        }
        if (step.kind === 'give-up') {
          show({ kind: 'still-pending' });
          return;
        }
        if (step.kind === 'repost' && response.data.status === 'pending') {
          show({
            kind: 'pending',
            seconds: Math.ceil(step.delayMs / 1000),
            repost: repostsDone + 1,
          });
          await new Promise<void>((resolve) => setTimeout(resolve, step.delayMs));
          if (!alive()) {
            return;
          }
        }
      }
    } finally {
      // Clears the mutation's tracked result on every way out.
      reset();
    }
  };

  const status = describe(phase);

  return (
    <AppSurface
      style={[styles.card, { borderColor: colors.border }]}>
      <AppText accessibilityRole="header" variant="label">
        {t('orderDev.title')}
      </AppText>
      <AppText tone="muted">{t('orderDev.note')}</AppText>
      <AppButton
        accessibilityHint={t('orderDev.buttonHint')}
        disabled={busy}
        label={t('orderDev.button')}
        maxFontSizeMultiplier={fontScaleLimits.actionLabel}
        onPress={() => {
          void run();
        }}
        variant="primary"
      />
      {/* Always mounted so a screen reader sees the text CHANGE; the state never relies on color. */}
      <View accessibilityLiveRegion="polite" style={styles.status}>
        {busy && !reduceMotionEnabled ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : null}
        {status === '' ? null : (
          <AppText
            accessibilityRole={phase.kind === 'error' ? 'alert' : undefined}
            style={styles.statusText}>
            {status}
          </AppText>
        )}
      </View>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    alignSelf: 'stretch',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // `flex: 1` + `minWidth: 0`: the text wraps beside the spinner instead of overflowing (F-1/G-1).
  statusText: {
    flex: 1,
    minWidth: 0,
  },
});
