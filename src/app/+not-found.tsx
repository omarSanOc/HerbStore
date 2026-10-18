import { NotFoundScreen } from '@/features/navigation/screens/NotFoundScreen';
import { useGoToHomeFromRoot } from '@/features/navigation/use-go-to-home-from-root';
import { useTranslation } from 'react-i18next';

/**
 * Catch-all for URLs of the app scheme that match no route (for example `herbstore://unknown`). It is
 * a screen of the ROOT Stack, above `(tabs)`, so its "Go to Home" uses the root plan.
 */
export default function NotFoundRoute() {
  const { t } = useTranslation();
  const goHome = useGoToHomeFromRoot();
  return <NotFoundScreen title={t('link.notRecognizedTitle')} message={t('link.notRecognizedMessage')} onGoHome={goHome} />;
}
