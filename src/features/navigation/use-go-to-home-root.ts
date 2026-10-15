import { useNavigation } from 'expo-router';

import { planHomeRoot } from './logic/home-root-plan';

/**
 * Returns an action that selects the Home tab showing its root screen, without stacking a second Home
 * (spec 005, RF-37). Used only by the empty cart: other exits to Home keep their previous behavior.
 *
 * It talks to the Tabs navigator directly (`useNavigation('/(tabs)')`, the expo-router 57 way to reach a
 * parent layout) and dispatches the pure plan from `home-root-plan.ts`. The state is read at press
 * time, never during render, so a second tap plans from the already-updated state.
 */
export function useGoToHomeRoot(): () => void {
  const tabs = useNavigation('/(tabs)');

  return () => {
    for (const action of planHomeRoot(tabs.getState())) {
      tabs.dispatch(action);
    }
  };
}
