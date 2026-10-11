import { redirectSystemPath as redirectIncomingLink } from '@/core/navigation/linking';

/**
 * Expo Router calls this for the launch URL (`initial: true`) and for every link received while
 * the app is open. The rules live in `core/navigation/linking` so they can be tested on plain Node.
 */
export function redirectSystemPath(event: { path: string; initial: boolean }): string | null {
  const target = redirectIncomingLink(event);

  if (__DEV__) {
    // Outcome only: the URL itself can carry user data, so it is never logged.
    console.log(`[deep-link] initial=${String(event?.initial)} -> ${target === null ? 'ignored' : 'redirected'}`);
  }

  return target;
}
