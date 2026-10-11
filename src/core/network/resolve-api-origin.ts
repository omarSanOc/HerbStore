/** Port of the local mock server (`mock-server/`). */
export const MOCK_SERVER_PORT = 3001;

export type ApiOriginSource =
  | 'override'
  | 'android-emulator'
  | 'android-device'
  | 'ios-simulator'
  | 'ios-device-needs-override'
  | 'other-platform';

export type ApiOriginInput = {
  /** `Platform.OS`. */
  os: string;
  /** `expo-device` `isDevice`: false on emulators and simulators. */
  isDevice: boolean;
  /** Raw value of `EXPO_PUBLIC_API_ORIGIN`, if any. */
  override?: string | undefined;
};

export type ApiOriginResolution = {
  /** Origin without a trailing slash, e.g. `http://10.0.2.2:3001`. */
  origin: string;
  source: ApiOriginSource;
  /** True when an override was provided but is not a bare http(s) origin, so it was ignored. */
  overrideRejected: boolean;
};

// scheme + host (letters, digits, dots, hyphens) + optional port. No credentials, path or query.
const BARE_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(?::(\d{1,5}))?$/;

function normalizeOverride(raw: string): string | null {
  const candidate = raw.trim().replace(/\/+$/, '');
  const match = BARE_ORIGIN.exec(candidate);

  if (match === null) {
    return null;
  }

  const port = match[1];
  if (port !== undefined && Number(port) > 65_535) {
    return null;
  }

  return candidate;
}

function defaultFor(os: string, isDevice: boolean): Pick<ApiOriginResolution, 'origin' | 'source'> {
  const localhost = `http://localhost:${MOCK_SERVER_PORT}`;

  if (os === 'android') {
    // Emulator reaches the host through the 10.0.2.2 alias; a physical device uses
    // `adb reverse tcp:3001 tcp:3001`, which makes the host's server answer on its own localhost.
    return isDevice
      ? { origin: localhost, source: 'android-device' }
      : { origin: `http://10.0.2.2:${MOCK_SERVER_PORT}`, source: 'android-emulator' };
  }

  if (os === 'ios') {
    // The simulator shares the host network. A physical iPhone cannot reach the host's
    // localhost: it needs the LAN IP in the override.
    return isDevice
      ? { origin: localhost, source: 'ios-device-needs-override' }
      : { origin: localhost, source: 'ios-simulator' };
  }

  return { origin: localhost, source: 'other-platform' };
}

/**
 * Pure development-time rule that picks the mock server origin. Production would require HTTPS
 * and a configured origin; that is out of scope for Day 2.
 */
export function resolveApiOrigin({ os, isDevice, override }: ApiOriginInput): ApiOriginResolution {
  const trimmed = override?.trim() ?? '';

  if (trimmed !== '') {
    const normalized = normalizeOverride(trimmed);

    if (normalized !== null) {
      return { origin: normalized, source: 'override', overrideRejected: false };
    }

    return { ...defaultFor(os, isDevice), overrideRejected: true };
  }

  return { ...defaultFor(os, isDevice), overrideRejected: false };
}
