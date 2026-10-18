import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';

import { selectThemePreference, themeChanged } from '../store/preferences-slice';
import { PreferenceChoiceCard } from './PreferenceChoiceCard';

/** Chooses system (follows the OS, also while the app is open), light or dark. */
export function ThemeSelector() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useAppSelector(selectThemePreference);

  return (
    <PreferenceChoiceCard
      description={t('preferences.theme.description')}
      heading={t('preferences.theme.heading')}
      onSelect={(value) => dispatch(themeChanged(value))}
      options={[
        { value: 'system', label: t('preferences.theme.system'), hint: t('preferences.theme.selectSystemHint') },
        { value: 'light', label: t('preferences.theme.light'), hint: t('preferences.theme.selectLightHint') },
        { value: 'dark', label: t('preferences.theme.dark'), hint: t('preferences.theme.selectDarkHint') },
      ]}
      selected={theme}
    />
  );
}
