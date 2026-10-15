import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ScannerHeaderCloseButton } from '@/features/scanner/components/ScannerHeaderCloseButton';
import { useStackScreenOptions } from '@/features/navigation/use-stack-screen-options';

// A link straight to `/scanner/product/<id>` puts the scanner (`index`, in its preview state) under
// the product, so the arrow of the product has somewhere to go instead of being the only screen.
export const unstable_settings = {
  anchor: 'index',
};

/**
 * Inner stack of the scanner modal. Each screen draws its OWN header, because the two exits mean
 * different things:
 * - `index` (preview, camera, errors): the close button dismisses the whole modal (RF-19).
 * - `product/[id]` (the scanned product): the native arrow pops THIS stack, back to "Ready to
 *   scan", the same as the hardware Back button and the back gesture (RF-13).
 *
 * A header owned by the modal route (the root stack) could not tell them apart: its arrow always
 * pops the root stack. Kotlin: a `NavHost` nested in the destination of another `NavHost`, whose
 * `popBackStack()` only reaches the outer one when the inner one is at its start. SwiftUI: a
 * `NavigationStack` inside a `.sheet`, whose back button pops the stack and whose `dismiss()` closes
 * the sheet.
 */
export default function ScannerLayout() {
  const { t } = useTranslation();
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="index"
        options={{
          headerLeft: () => <ScannerHeaderCloseButton />,
          title: t('scanner.title'),
        }}
      />
      <Stack.Screen name="product/[id]" options={{ title: t('product.title') }} />
    </Stack>
  );
}
