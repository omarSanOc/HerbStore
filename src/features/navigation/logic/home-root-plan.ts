// How "Go Home" from the empty cart reaches the ROOT of the Home tab (spec 005, RF-37). Pure: it reads
// the Tabs state and returns plain React Navigation actions; `use-go-to-home-root.ts` dispatches them.
//
// Why these two actions (read in expo-router 57.0.27, `build/react-navigation/routers/*`):
// - `router.dismissTo('/')` is POP_TO, which TabRouter does not handle: from the Cart tab it does
//   nothing (H-T8-2). `navigate('/')` does switch tab, but the Home stack receives NAVIGATE `index` and,
//   with a product on top, pushes a SECOND `index` (back arrow on Inicio).
// - `POP_TO_TOP` targeted at the Home stack key keeps its `routes[0]` and, because the target is that
//   navigator, it never ends up "not handled" (no dev warning) even when there is nothing to pop. It is
//   only planned with more than one screen, while Home is still hidden: the user sees no back animation.
// - `JUMP_TO` targeted at the Tabs key only changes the focused tab; it sends nothing to the child stack.
// Discarded: reusing `goHome` (RF-24, contains `dismissTo`), `navigate` + `dismissAll` (untargeted
// POP_TO_TOP warns at the root), `popToTopOnBlur` (changes every tab), resetting the whole state (loses
// the other tabs) and `replace('/')` (replaces the cart screen instead of selecting Home).
//
// Compose: select the Home item and `navController.navigate(HomeGraph) { popUpTo(HomeRoot); launchSingleTop = true }`.
// SwiftUI: `homePath = NavigationPath()` and then `selection = .home` on the `TabView`.

/** Name of the Home tab route inside the Tabs navigator (`src/app/(tabs)/(home)`). */
export const HOME_TAB_ROUTE = '(home)';

/** The minimal slice of a navigator state this plan reads. Real states carry more fields. */
export type StackStateLike = Readonly<{
  key?: string;
  routes: readonly Readonly<{ name: string }>[];
}>;

export type TabsStateLike = Readonly<{
  key: string;
  routes: readonly Readonly<{ name: string; state?: StackStateLike }>[];
}>;

export type HomeRootAction =
  | Readonly<{ type: 'POP_TO_TOP'; target: string }>
  | Readonly<{ type: 'JUMP_TO'; payload: Readonly<{ name: typeof HOME_TAB_ROUTE }>; target: string }>;

/**
 * Plans, in order: pop the Home stack to its root (only when it has more than one screen and a key to
 * target), then select the Home tab. No Tabs state or no Home tab plans nothing. Never NAVIGATE/PUSH
 * (they create instances) nor POP_TO (Tabs ignores it). Running it again after the plan only jumps.
 */
export function planHomeRoot(tabs: TabsStateLike | undefined): HomeRootAction[] {
  const home = tabs?.routes.find((route) => route.name === HOME_TAB_ROUTE);
  if (!tabs || !home) return [];

  const plan: HomeRootAction[] = [];
  const stack = home.state;
  if (stack?.key && stack.routes.length > 1) {
    plan.push({ type: 'POP_TO_TOP', target: stack.key });
  }
  plan.push({ type: 'JUMP_TO', payload: { name: HOME_TAB_ROUTE }, target: tabs.key });
  return plan;
}

/** The root Stack (`src/app/_layout.tsx`): `(tabs)` plus whatever sits above it. */
export type RootStateLike = Readonly<{
  key: string;
  routes: readonly Readonly<{ name: string; state?: TabsStateLike }>[];
}>;

/**
 * `actions` are dispatched in order. `needsReplace` is the fallback for a root state that has no
 * `(tabs)` to select (or no state at all): the caller replaces the current route with `/`, which
 * creates the tabs. Only then is `actions` empty for a reason other than "already there".
 */
export type RootHomePlan = Readonly<{ actions: HomeRootAction[]; needsReplace: boolean }>;

/** Name of the tabs route inside the root Stack (`src/app/(tabs)`). */
export const TABS_ROOT_ROUTE = '(tabs)';

/**
 * "Go to Home" from a screen of the ROOT Stack that sits above `(tabs)` (today only `+not-found`,
 * spec 006 T4b). Same idea as `planHomeRoot` plus one step for the root Stack:
 *
 * 1. `planHomeRoot` on the nested Tabs state: pop the Home stack to its root and select the tab.
 *    Both are still hidden behind the not-found screen, so the user sees no back animation there.
 * 2. `POP_TO_TOP` targeted at the ROOT stack key, LAST: it drops `+not-found` (and a scanner modal
 *    under it) and leaves `routes[0]`, which `unstable_settings.anchor = '(tabs)'` guarantees is
 *    `(tabs)`. That is the only animation the user sees: the screen slides away onto Home.
 *
 * Why not `router.dismissTo('/')` (the Day 5 code): it is a POP_TO that does not find `/` in the
 * root stack, so it ends up creating a NEW `(tabs)`/Home instance over the stacked detail (back
 * arrow on Home). Why not an untargeted `dismissAll`: it warns "not handled" at the root.
 *
 * Read in expo-router 57.0.28 (`build/react-navigation/core/useOnAction.js`): an action with a
 * `target` string dispatched from the root navigator skips its own router when the key differs and,
 * after trying the parents, offers it to the CHILD navigators' action listeners, so a root
 * `dispatch` reaches the Tabs and Home stacks. An action whose target is the navigator that
 * handles it is never "not handled", even with nothing to pop.
 *
 * Compose: `navController.popBackStack(HomeRoute, inclusive = false)` and select the Home item.
 * SwiftUI: reset the root `NavigationPath` and set the `TabView` selection to `.home`.
 */
export function planHomeRootFromRoot(root: RootStateLike | undefined): RootHomePlan {
  const tabsRoute = root?.routes.find((route) => route.name === TABS_ROOT_ROUTE);
  if (!root || !tabsRoute) return { actions: [], needsReplace: true };

  // A `(tabs)` route that has not published its state yet defaults to the first tab, Home.
  const actions: HomeRootAction[] = planHomeRoot(tabsRoute.state);
  if (root.routes.length > 1) actions.push({ type: 'POP_TO_TOP', target: root.key });
  return { actions, needsReplace: false };
}
