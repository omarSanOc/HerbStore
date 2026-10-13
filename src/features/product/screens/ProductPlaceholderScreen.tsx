import { skipToken } from '@reduxjs/toolkit/query/react';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toApiError } from '@/core/api/api-error';
import { AppButton, AppText, useAppTheme } from '@/design-system';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';

import { useGetProductQuery } from '../data/products-api';
import { classifyProductLookup } from '../logic/product-lookup';
import { parseProductId } from '../parse-product-id';

/*
 * DEV-only control (RF-7), removed on Day 4 (H-4) together with this placeholder.
 *
 * It is loaded with `require` under `__DEV__` on purpose, NOT with `import` + `__DEV__ && <X />`:
 * Metro replaces `__DEV__` with `false` in a release build and drops the dead branch, so the
 * `require` disappears and the module (with its fictitious address and the order endpoint) never
 * reaches the bundle. A static `import` is bundled whatever the JSX does; it was measured: the
 * strings of the control were in the release bundle.
 */
type OrderDevControlsModule = typeof import('@/features/checkout/components/OrderDevControls');
const OrderDevControls = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional load, see above
    (require('@/features/checkout/components/OrderDevControls') as OrderDevControlsModule)
      .OrderDevControls
  : null;

type ProductPlaceholderScreenProps = {
  /** Raw route param: may be missing, repeated (array) or malformed. */
  rawId: unknown;
};

/**
 * Destination for a product: it only proves the product exists (name and id). The real detail
 * screen replaces it on Day 4.
 *
 * Since Day 3 the request is `getProduct` (RTK Query) and `classifyProductLookup` (pure) turns
 * `{ data, error, isFetching }` into the same five states as Day 2. `skipToken` is the RTK way of
 * saying "do not run this query": an id with an invalid shape never reaches the network.
 */
export function ProductPlaceholderScreen({ rawId }: Readonly<ProductPlaceholderScreenProps>) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const productId = parseProductId(rawId);
  const { data, error, isFetching, refetch } = useGetProductQuery(productId ?? skipToken);

  if (productId === undefined) {
    return (
      <NotFoundScreen message={t('product.notFoundMessage')} title={t('product.notFoundTitle')} />
    );
  }

  const state = classifyProductLookup({ data, error: toApiError(error), isFetching });
  const retry = () => {
    void refetch();
  };

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
          {OrderDevControls === null ? null : (
            <OrderDevControls currency={state.product.currency} productId={state.product.id} />
          )}
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
            onPress={retry}
          />
        </MessageScreen>
      );
    case 'error':
      return (
        <MessageScreen message={t('product.errorMessage')} title={t('product.errorTitle')}>
          <AppButton
            accessibilityHint={t('product.retryHint')}
            label={t('product.retry')}
            onPress={retry}
          />
        </MessageScreen>
      );
  }
}
