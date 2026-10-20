import { skipToken } from '@reduxjs/toolkit/query/react';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useCurrentLanguage } from '@/core/i18n/use-current-language';
import { AppSurface, AppText, fontScaleLimits } from '@/design-system';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { useNavigationLockout } from '@/features/navigation/use-navigation-lockout';
import { useGetCategoriesQuery } from '@/features/product/data/products-api';
import { ProductListView } from '@/features/product/list/ProductListView';

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
 * - The name is copy OF THE CATALOG (RF-9, RF-22): the name of the localized category tree, shown
 *   exactly as the API sent it. There is no translation table by id any more; while the tree has
 *   not arrived (or does not know the id) the title is the generic i18n chrome, which is the only
 *   part of the heading that belongs to the resources.
 */
export function CategoryProductsScreen({ rawId }: Readonly<CategoryProductsScreenProps>) {
  const { t } = useTranslation();
  const router = useRouter();
  const navigate = useNavigationLockout();
  const categoryId = parseCategoryId(rawId);
  // The tree is a localized read: the language is part of the argument (RF-22, RF-24). An invalid
  // id never asks for it (`skipToken`), so a malformed link still makes zero requests.
  const language = useCurrentLanguage();
  const { data: categories } = useGetCategoriesQuery(categoryId === undefined ? skipToken : language);

  if (categoryId === undefined) {
    return (
      <NotFoundScreen
        message={t('category.invalidMessage')}
        title={t('category.invalidTitle')}
      />
    );
  }

  const name = categories?.find((category) => category.id === categoryId)?.name ?? t('category.title');

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
