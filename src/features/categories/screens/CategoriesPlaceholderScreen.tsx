import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';

/**
 * Placeholder of the Categories tab: the category list is not part of the current scope (the
 * categories open from Home), so the tab keeps this message.
 */
export function CategoriesPlaceholderScreen() {
  const { t } = useTranslation();

  return <PlaceholderScreen body={t('placeholders.categories.body')} />;
}
