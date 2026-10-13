import { useState } from 'react';

import { AppButton } from '@/design-system';
import { ConceptCard } from '@/features/foundations/components/ConceptCard';
import { useTranslation } from 'react-i18next';

export function RenderErrorDemo() {
  const { t } = useTranslation();
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Intentional render error from the development-only Foundations demo.');
  }

  return (
    <ConceptCard description={t('errorDev.description')} title={t('errorDev.heading')}>
      <AppButton
        accessibilityHint={t('errorDev.triggerHint')}
        label={t('errorDev.trigger')}
        onPress={() => setShouldThrow(true)}
      />
    </ConceptCard>
  );
}
