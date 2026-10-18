import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, radii, spacing, useAppTheme } from '@/design-system';

import type { ProductNotice } from '../logic/product-lookup';

type ProductNoticeRowProps = {
  notice: ProductNotice;
  onRetry: () => void;
};

/**
 * Warning above a product that is kept after a failed revalidation: its price and stock are the
 * last ones received and may be old. Same pattern as `HomeNoticeRow` / `ProductListNoticeRow`: a
 * polite live region announces it when it appears and the button asks the server again.
 *
 * Compose: a `Card` with `Modifier.semantics { liveRegion = LiveRegionMode.Polite }`; SwiftUI: a
 * `Text` with `.accessibilityAddTraits(.updatesFrequently)` plus a `Button`.
 */
export function ProductNoticeRow({ notice, onRetry }: Readonly<ProductNoticeRowProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={styles.scalableText}>
        {t(notice === 'offline' ? 'product.notice.offline' : 'product.notice.updateFailed')}
      </AppText>
      <View style={styles.action}>
        <AppButton
          accessibilityHint={t('product.retryHint')}
          label={t('product.retry')}
          labelStyle={styles.scalableText}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  action: {
    alignItems: 'flex-start',
  },
  // RN scales `fontSize` but Android keeps an explicit numeric `lineHeight` in dp. Let the native
  // text layout derive its line box from the scaled glyphs; otherwise 2.0 text is painted into the
  // 1.0-height body/label boxes and is visibly clipped.
  scalableText: {
    lineHeight: undefined,
  },
});
