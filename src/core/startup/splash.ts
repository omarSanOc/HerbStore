import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

/** The longest the native splash is held waiting for the persisted preferences (about one second). */
export const SPLASH_CAP_MS = 1000;

/**
 * Keeps the native splash over the first frames. Call it in the GLOBAL scope of the root layout,
 * before any view renders (expo-splash-screen SDK 57): by default the splash hides when the first
 * React Native view mounts, and expo-router only hides it itself when the app did not take control.
 * A rejection means the splash was already hidden; there is nothing left to hold.
 */
export async function holdSplash(): Promise<void> {
  try {
    await SplashScreen.preventAutoHideAsync();
  } catch {
    // Already hidden: the first frame may show the device language for a moment, nothing breaks.
  }
}

/**
 * Hides the splash once the preferences are restored, or after `SPLASH_CAP_MS` whatever happens.
 * The tree below is already mounted (Home never waits for the disk, decided on Day 4): the splash
 * only covers the frames in which the language or the theme could still change.
 */
export function useReleaseSplash(ready: boolean): void {
  useEffect(() => {
    const release = () => {
      void Promise.resolve(SplashScreen.hideAsync()).catch(() => undefined);
    };

    if (ready) {
      release();
      return undefined;
    }

    const timer = setTimeout(release, SPLASH_CAP_MS);
    return () => clearTimeout(timer);
  }, [ready]);
}
