import { useState } from 'react';

import { createNavigationLockout } from './logic/navigation-lockout';

/**
 * Returns `run(action)`: the action runs unless this screen navigated less than
 * `NAVIGATION_LOCKOUT_MS` ago. Every handler of the screen that calls the router goes through the
 * SAME `run`, so two taps on two different cards (two fingers) also open a single destination.
 *
 * The lockout lives in `useState`'s lazy initializer: one instance per mounted screen, stable across
 * renders, and it never causes a render (nothing on screen depends on it).
 */
export function useNavigationLockout(): (action: () => void) => boolean {
  const [lockout] = useState(createNavigationLockout);
  return lockout.run;
}
