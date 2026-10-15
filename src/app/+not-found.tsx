import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { useTranslation } from 'react-i18next';

/** Catch-all for URLs of the app scheme that match no route (for example `herbstore://unknown`). */
export default function NotFoundRoute() {
  const { t } = useTranslation();
  return <NotFoundScreen title={t('link.notRecognizedTitle')} message={t('link.notRecognizedMessage')} />;
}
