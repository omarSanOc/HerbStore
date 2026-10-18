import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';

import { currencyChanged, selectPreferredCurrency } from '../store/preferences-slice';
import { PreferenceChoiceCard } from './PreferenceChoiceCard';

/**
 * Chooses the currency every price is shown in (MXN or USD). The choice is persisted (Day 6) and
 * only changes the view: the canonical amounts stay in MXN cents.
 */
export function CurrencySelector() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const currency = useAppSelector(selectPreferredCurrency);

  return (
    <PreferenceChoiceCard
      description={t('preferences.currency.description')}
      heading={t('preferences.currency.heading')}
      onSelect={(value) => dispatch(currencyChanged(value))}
      options={[
        { value: 'MXN', label: t('preferences.currency.mxn'), hint: t('preferences.currency.selectMxnHint') },
        { value: 'USD', label: t('preferences.currency.usd'), hint: t('preferences.currency.selectUsdHint') },
      ]}
      selected={currency}
    />
  );
}
