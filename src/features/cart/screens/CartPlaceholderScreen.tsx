import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/navigation/screens/PlaceholderScreen';

import { CartDevControls } from '../components/CartDevControls';

export function CartPlaceholderScreen() {
  const { t } = useTranslation();

  return (
    <PlaceholderScreen body={t('placeholders.cart.body')}>
      {__DEV__ ? <CartDevControls /> : null}
    </PlaceholderScreen>
  );
}
