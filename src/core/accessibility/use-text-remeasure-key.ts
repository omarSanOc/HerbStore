import { Platform } from 'react-native';

import { textRemeasureKey } from '@/design-system/font-scale-key';

import { useFontScale } from './use-font-scale';

/**
 * The `key` for a text node (`Text`, `TextInput`) so that it is measured again when the user changes
 * the system text size while the app is open (H-10 = N-4, see `font-scale-key.ts`). `undefined` where
 * the platform already restarts the screen on that change (Android).
 */
export function useTextRemeasureKey(): number | undefined {
  return textRemeasureKey(Platform.OS, useFontScale());
}
