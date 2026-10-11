import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/design-system';
import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';

export function AccountPlaceholderScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <PlaceholderScreen body={t('placeholders.account.body')}>
      <AppButton
        accessibilityHint={t('placeholders.account.openFoundationsHint')}
        label={t('placeholders.account.openFoundations')}
        onPress={() => router.push('/foundations')}
      />
    </PlaceholderScreen>
  );
}
