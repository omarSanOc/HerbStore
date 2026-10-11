import { useRouter } from 'expo-router';

/**
 * Returns an action that goes back one screen, or to Home when there is nothing to go back to
 * (a deep link can land on a destination with no history beneath it).
 */
export function useGoBackOrHome(): () => void {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };
}
