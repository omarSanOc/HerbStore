import { useTranslation } from 'react-i18next';

import { AppButton } from '@/design-system';
import { useGoBackOrHome } from '@/features/navigation/use-go-back-or-home';
import { MessageScreen } from '@/features/navigation/screens/MessageScreen';

/**
 * Modal placeholder for the product scanner. The real camera arrives on Day 5.
 * The close button is mandatory: on Android a modal is a regular stack screen with no gesture.
 */
export function ScannerPlaceholderScreen() {
  const { t } = useTranslation();
  const close = useGoBackOrHome();

  return (
    <MessageScreen message={t('scanner.body')} title={t('scanner.heading')}>
      <AppButton
        accessibilityHint={t('scanner.closeHint')}
        label={t('scanner.close')}
        onPress={close}
      />
    </MessageScreen>
  );
}
