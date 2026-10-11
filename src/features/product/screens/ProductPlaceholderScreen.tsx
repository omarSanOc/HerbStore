import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppButton, AppText, useAppTheme } from '@/design-system';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';

import { parseProductId } from '../parse-product-id';
import { useProductExists } from '../use-product-exists';

type ProductPlaceholderScreenProps = {
  /** Raw route param: may be missing, repeated (array) or malformed. */
  rawId: unknown;
};

/**
 * Day 2 destination for a product: it only proves the product exists (name and id).
 * The real detail screen replaces it on Day 4.
 */
export function ProductPlaceholderScreen({ rawId }: Readonly<ProductPlaceholderScreenProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const productId = parseProductId(rawId);
  const state = useProductExists(productId);

  switch (state.status) {
    case 'loading':
      return (
        <MessageScreen title={t('product.loadingTitle')}>
          <ActivityIndicator
            accessibilityLabel={t('product.loadingTitle')}
            color={colors.primary}
            size="large"
          />
        </MessageScreen>
      );
    case 'found':
      return (
        <MessageScreen message={t('product.placeholderNote')} title={state.product.name}>
          <AppText tone="muted">{t('product.idLabel', { id: state.product.id })}</AppText>
        </MessageScreen>
      );
    case 'not-found':
      return (
        <NotFoundScreen
          message={t('product.notFoundMessage')}
          title={t('product.notFoundTitle')}
        />
      );
    case 'offline':
      return (
        <MessageScreen message={t('product.offlineMessage')} title={t('product.offlineTitle')}>
          <AppButton
            accessibilityHint={t('product.retryHint')}
            label={t('product.retry')}
            onPress={state.retry}
          />
        </MessageScreen>
      );
    case 'error':
      return (
        <MessageScreen message={t('product.errorMessage')} title={t('product.errorTitle')}>
          <AppButton
            accessibilityHint={t('product.retryHint')}
            label={t('product.retry')}
            onPress={state.retry}
          />
        </MessageScreen>
      );
  }
}
