import { useRouter } from 'expo-router';

import { useNavigationLockout } from './use-navigation-lockout';

/**
 * Returns an action that goes back one screen, or to Home when there is nothing to go back to
 * (a deep link can land on a destination with no history beneath it).
 *
 * A fast double tap on "Back" / "Close" runs it once: a second `router.back()` before the first
 * transition settles would pop a second screen (M-6, spec 006 T3a).
 */
export function useGoBackOrHome(): () => void {
  const router = useRouter();
  const run = useNavigationLockout();

  return () => {
    run(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    });
  };
}
