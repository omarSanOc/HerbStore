import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { AppButton, AppText, radii, spacing, useAppTheme } from '@/design-system';

import type { ProductListFooter, ProductListNotice } from '../logic/product-list-state';
import { GRID_CELL_PADDING } from './grid-layout';

/** The action an empty list offers; the caller decides what it does (go Home, clear filters...). */
export type EmptyAction = {
  label: string;
  hint: string;
  onPress: () => void;
};

/** Already translated title and message of an empty list, for a screen with its own wording (search). */
export type EmptyCopy = {
  title: string;
  message: string;
};

type ProductListStatusProps = {
  status: 'empty' | 'offline' | 'error';
  onRetry: () => void;
  emptyAction?: EmptyAction;
  /** The empty list has filters on: the message is about them, not about the category. */
  filtered?: boolean;
  /** Replaces the default wording of the empty state (the search says "No results for ..."). */
  emptyCopy?: EmptyCopy;
};

const copy = {
  empty: { title: 'productList.empty.title', message: 'productList.empty.message' },
  offline: { title: 'productList.states.offlineTitle', message: 'productList.states.offlineMessage' },
  error: { title: 'productList.states.errorTitle', message: 'productList.states.errorMessage' },
  emptyFiltered: {
    title: 'productList.emptyFiltered.title',
    message: 'productList.emptyFiltered.message',
  },
} as const;

/**
 * Full-width state of a list that has no products: nothing found (not a failure), no connection
 * (`fetch` got no answer) or a failed answer. "Offline" and "error" are different messages and
 * both offer a manual retry (RF-8, RF-19); "empty" offers the action the screen gives it (go
 * Home for an empty category, "Clear filters" when the filters caused the emptiness).
 */
export function ProductListStatus({
  status,
  onRetry,
  emptyAction,
  filtered = false,
  emptyCopy,
}: Readonly<ProductListStatusProps>) {
  const { t } = useTranslation();
  const keys = copy[status === 'empty' && filtered ? 'emptyFiltered' : status];
  const text =
    status === 'empty' && emptyCopy !== undefined
      ? emptyCopy
      : { title: t(keys.title), message: t(keys.message) };

  return (
    <View style={styles.column}>
      <AppText accessibilityRole="header" variant="subheading">
        {text.title}
      </AppText>
      <AppText tone="muted">{text.message}</AppText>
      <View style={styles.action}>
        {status === 'empty' ? (
          emptyAction === undefined ? null : (
            <AppButton
              accessibilityHint={emptyAction.hint}
              label={emptyAction.label}
              onPress={emptyAction.onPress}
            />
          )
        ) : (
          <AppButton
            accessibilityHint={t('productList.states.retryHint')}
            label={t('productList.states.retry')}
            onPress={onRetry}
          />
        )}
      </View>
    </View>
  );
}

type ProductListNoticeRowProps = {
  notice: ProductListNotice;
  onRetry: () => void;
};

/**
 * Warning above products that are kept after a failed update. A polite live region announces it
 * when it appears; the retry button is the alternative to the pull gesture (RF-19).
 */
export function ProductListNoticeRow({ notice, onRetry }: Readonly<ProductListNoticeRowProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  return (
    <View style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AppText accessibilityLiveRegion="polite" accessibilityRole="alert">
        {t(notice === 'offline' ? 'productList.notice.offline' : 'productList.notice.updateFailed')}
      </AppText>
      <View style={styles.action}>
        <AppButton
          accessibilityHint={t('productList.states.retryHint')}
          label={t('productList.states.retry')}
          onPress={onRetry}
        />
      </View>
    </View>
  );
}

type ProductListFooterRowProps = {
  footer: Exclude<ProductListFooter, 'idle'>;
  /** Absent until the list can load more pages: without it the failure shows no button. */
  onRetry?: () => void;
};

/**
 * End of the list: progress while the next page loads, or its failure (the products stay). The
 * spinner is a motion indicator, so with reduced motion the text stands alone (RNF-3).
 */
export function ProductListFooterRow({ footer, onRetry }: Readonly<ProductListFooterRowProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotionPreference();

  if (footer === 'loading-more') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.footer}>
        {reduceMotion ? null : <ActivityIndicator color={colors.primary} />}
        <AppText tone="muted">{t('productList.footer.loadingMore')}</AppText>
      </View>
    );
  }

  return (
    <View style={styles.footer}>
      <AppText accessibilityLiveRegion="polite" tone="muted">
        {t('productList.footer.loadMoreFailed')}
      </AppText>
      {onRetry === undefined ? null : (
        <AppButton
          accessibilityHint={t('productList.states.retryHint')}
          label={t('productList.states.retry')}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Horizontal: only the padding of a cell, because the container already pads by the rest of
  // the screen margin (see `grid-layout.ts`).
  column: {
    gap: spacing.md,
    paddingHorizontal: GRID_CELL_PADDING,
    paddingVertical: spacing.md,
  },
  action: {
    alignItems: 'flex-start',
  },
  notice: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
});
