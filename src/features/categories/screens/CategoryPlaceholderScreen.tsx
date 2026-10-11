import { useTranslation } from 'react-i18next';

import { AppText } from '@/design-system';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';
import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';

import { parseCategoryId } from '../parse-category-id';

type CategoryPlaceholderScreenProps = {
  /** Raw route param: may be missing, repeated (array) or malformed. */
  rawId: unknown;
};

/**
 * Day 2 destination for a category: it proves the selected parameter arrives validated.
 * The product listing replaces it on Day 3.
 */
export function CategoryPlaceholderScreen({ rawId }: Readonly<CategoryPlaceholderScreenProps>) {
  const { t } = useTranslation();
  const categoryId = parseCategoryId(rawId);

  if (categoryId === undefined) {
    return (
      <NotFoundScreen
        message={t('category.invalidMessage')}
        title={t('category.invalidTitle')}
      />
    );
  }

  return (
    <MessageScreen message={t('category.note')} title={t('category.title')}>
      <AppText tone="muted">{t('category.idLabel', { id: categoryId })}</AppText>
    </MessageScreen>
  );
}
