import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';

/** Replaced by the real category list on Day 3. */
export function CategoriesPlaceholderScreen() {
  const { t } = useTranslation();

  return <PlaceholderScreen body={t('placeholders.categories.body')} />;
}
