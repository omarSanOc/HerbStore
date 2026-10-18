import { skipToken } from '@reduxjs/toolkit/query/react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppSurface, AppText, fontScaleLimits } from '@/design-system';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { useNavigationLockout } from '@/features/navigation/use-navigation-lockout';
import { useGetCategoriesQuery } from '@/features/product/data/products-api';
import { ProductListView } from '@/features/product/list/ProductListView';

import { categoryLabelKey } from '../category-labels';
import { parseCategoryId } from '../parse-category-id';

type CategoryProductsScreenProps = {
  /** Raw route param: may be missing, repeated (array) or malformed. */
  rawId: unknown;
};

/**
 * A category: its name, the "N products" counter and the product grid (`ProductListView`).
 *
 * - The route parameter is validated first. An id with an invalid shape is "not found" and
 *   NEVER reaches the network (`skipToken` below and no `ProductListView` is mounted).
 * - A well-formed id that does not exist is not an error: the server answers `total: 0` and the
 *   list shows its empty state.
 * - The name is our translation of the five known categories (`categoryLabelKey`). Only an id
 *   without a translation asks the server for the category tree (cached, 5 min) and uses its
 *   text; if the server does not know it either, the title is the generic "Category".
 */
export function CategoryProductsScreen({ rawId }: Readonly<CategoryProductsScreenProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigationLockout();
  const categoryId = parseCategoryId(rawId);
  const labelKey = categoryId === undefined ? undefined : categoryLabelKey(categoryId);
  const needsServerName = categoryId !== undefined && labelKey === undefined;
  const { data: categories } = useGetCategoriesQuery(needsServerName ? undefined : skipToken);

  if (categoryId === undefined) {
    return (
      <NotFoundScreen
        message={t('category.invalidMessage')}
        title={t('category.invalidTitle')}
      />
    );
  }

  const name =
    labelKey === undefined
      ? (categories?.find((category) => category.id === categoryId)?.name ?? t('category.title'))
      : t(labelKey);

  return (
    <AppSurface level="page" style={styles.page}>
      <ProductListView
        // The filters and the sort are state of this view: another category (the route is
        // singular, so the same screen instance receives the new id) starts with none.
        key={categoryId}
        emptyAction={{
          label: t('notFound.goHome'),
          hint: t('notFound.goHomeHint'),
          onPress: () => router.dismissTo('/'),
        }}
        header={
          <AppText
            accessibilityRole="header"
            maxFontSizeMultiplier={fontScaleLimits.listTitle}
            variant="heading">
            {name}
          </AppText>
        }
        onOpenProduct={(id) =>
          navigate(() => router.push({ pathname: '/product/[id]', params: { id } }))
        }
        scope={{ category: categoryId }}
      />
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
});
