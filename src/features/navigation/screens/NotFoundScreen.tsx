import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/design-system';

import { useGoBackOrHome } from '../use-go-back-or-home';
import { MessageScreen } from './MessageScreen';

type NotFoundScreenProps = {
  /** Defaults to the generic copy; a feature passes its own wording. */
  title?: string;
  message?: string;
};

/** Shared "not found" destination with two exits: back, or straight to Home. */
export function NotFoundScreen({ title, message }: Readonly<NotFoundScreenProps>) {
  const { t } = useTranslation();
  const router = useRouter();

  // Arriving through a deep link can leave no previous screen: the hook falls back to Home.
  const goBack = useGoBackOrHome();

  return (
    <MessageScreen
      message={message ?? t('notFound.message')}
      title={title ?? t('notFound.title')}>
      <AppButton
        accessibilityHint={t('notFound.backHint')}
        label={t('notFound.back')}
        onPress={goBack}
      />
      <AppButton
        accessibilityHint={t('notFound.goHomeHint')}
        label={t('notFound.goHome')}
        onPress={() => router.dismissTo('/')}
      />
    </MessageScreen>
  );
}
