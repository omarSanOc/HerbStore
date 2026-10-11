import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';

/** Destination of Home's search entry. The real search (suggestions, history) arrives on Day 3. */
export function SearchPlaceholderScreen() {
  const { t } = useTranslation();

  return <PlaceholderScreen body={t('search.body')} />;
}
