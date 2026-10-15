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
