import { isDevice } from 'expo-device';
import { Platform } from 'react-native';

import { MOCK_SERVER_PORT, resolveApiOrigin } from './resolve-api-origin';

// Metro inlines `EXPO_PUBLIC_*` only for the literal `process.env.EXPO_PUBLIC_API_ORIGIN`
// expression, and only when Metro starts (restart with `-c` after editing `.env.local`).
const resolution = resolveApiOrigin({
  os: Platform.OS,
  isDevice,
  override: process.env.EXPO_PUBLIC_API_ORIGIN,
});

if (__DEV__) {
  if (resolution.overrideRejected) {
    console.warn(
      'EXPO_PUBLIC_API_ORIGIN is not a bare http(s) origin (e.g. http://192.168.1.20:3001); using the platform default.',
    );
  }
  if (resolution.source === 'ios-device-needs-override') {
    console.warn(
      `A physical iOS device cannot reach the host's localhost. Set EXPO_PUBLIC_API_ORIGIN in .env.local to http://<LAN_IP>:${MOCK_SERVER_PORT}.`,
    );
  }
}

/** Origin of the mock server for this device, resolved once at startup. */
export const apiOrigin = resolution.origin;
