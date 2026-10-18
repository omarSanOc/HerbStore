import { useNavigation, useRouter } from 'expo-router';

import { planHomeRootFromRoot, type RootStateLike } from './logic/home-root-plan';

/**
 * Returns the "Go to Home" action for a screen of the ROOT Stack that sits above `(tabs)` (today
 * `+not-found`, spec 006 T4b): Home selected at its root, no stacked detail, no second Home.
 *
 * `useNavigation()` without arguments is the navigator that holds this screen, here the root Stack,
 * so `getState()` is the root state with `(tabs)` and its nested Tabs/Home states, and `dispatch`
 * of an action with a `target` reaches the child navigators (see `planHomeRootFromRoot`). The state
 * is read at press time, never during render, so a second tap plans from the already-updated state.
 * If the state has no `(tabs)` the route is replaced with `/`, which creates the tabs.
 *
 * `useGoToHomeRoot` (the empty cart) stays as it is: from a tab screen the Tabs navigator is an
 * ancestor, from `+not-found` it is not.
 */
export function useGoToHomeFromRoot(): () => void {
  const navigation = useNavigation();
  const router = useRouter();

  return () => {
    const plan = planHomeRootFromRoot(navigation.getState() as RootStateLike | undefined);
    if (plan.needsReplace) {
      router.replace('/');
      return;
    }
    for (const action of plan.actions) {
      navigation.dispatch(action);
    }
  };
}
