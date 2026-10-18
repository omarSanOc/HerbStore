import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/core/store/hooks';

import { languageChanged } from '../store/preferences-slice';
import { PreferenceChoiceCard } from './PreferenceChoiceCard';

/**
 * Chooses the language of the whole app. The selected button is the language the app is speaking
 * NOW (`resolvedLanguage`), which is the device language until the user chooses one; the choice
 * goes through the preferences slice, whose listener is what changes i18n.
 * The names are written in their own language so they stay readable from the wrong one.
 */
export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const current = i18n.resolvedLanguage === 'en' ? 'en' : 'es';

  return (
    <PreferenceChoiceCard
      description={t('preferences.language.description')}
      heading={t('preferences.language.heading')}
      onSelect={(value) => dispatch(languageChanged(value))}
      options={[
        { value: 'es', label: t('preferences.language.spanish'), hint: t('preferences.language.selectSpanishHint') },
        { value: 'en', label: t('preferences.language.english'), hint: t('preferences.language.selectEnglishHint') },
      ]}
      selected={current}
    />
  );
}
