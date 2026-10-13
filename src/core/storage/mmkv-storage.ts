import { createMMKV } from 'react-native-mmkv';

import { createSafeStorage } from './persist-storage';

/**
 * The redux-persist engine of the app: MMKV behind the safe adapter of `persist-storage.ts`.
 * This is the ONLY import of `react-native-mmkv` (a native module: Nitro + JSI, so it needs the
 * Development Build, never Expo Go).
 *
 * - Own instance id, so nothing else shares the file that holds the persisted state.
 * - `discard-on-error`: if MMKV detects a CRC or length error, it drops the file instead of
 *   recovering a partial one; the app then starts from the initial state, which is what the spec
 *   asks for a corrupt state (and the sanitizer would reject a half state anyway).
 * - No encryption: the whitelist only allows non-sensitive data (constitution, point 5).
 * - Failures are reported with the operation only, never the stored value (RNF-1), and only in
 *   development.
 *
 * Android: like SharedPreferences/DataStore (MMKV itself was born at Tencent for Android/iOS).
 * iOS: like UserDefaults, but a memory-mapped file read synchronously through JSI.
 */
export const mmkvPersistStorage = createSafeStorage(
  () => createMMKV({ id: 'herbstore.persist', recoveryStrategy: 'discard-on-error' }),
  ({ operation, message }) => {
    if (__DEV__) {
      console.warn(`[storage] ${operation} failed: ${message}`);
    }
  },
);
