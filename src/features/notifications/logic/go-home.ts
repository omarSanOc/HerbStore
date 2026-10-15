// How a tap on the order notification reaches Home (spec 005, RF-24). Pure: the router is injected,
// so the order of the calls is pinned by `go-home.test.ts` and `test:logic` runs it.
//
// Why three calls (measured on the Samsung with expo-router 57, see docs/evidence/day-5-platform.md):
// - `dismissTo('/')` alone is POP_TO. Only stack navigators understand it: with another TAB focused
//   (the order confirmation lives in the Cart tab) the Tabs navigator ignores it and the tap does
//   nothing visible. With a scanner modal open it does pop the modal (the root stack has `(tabs)`).
// - `navigate('/')` alone does switch tab, but pushes a second Home `index` over whatever Home already
//   had (a back arrow appears on Inicio) and, over an open scanner modal, a second `(tabs)` under
//   which the scanner stays.
// - So: first `dismissTo('/')` closes modals and pops the focused stack, then `navigate('/')` focuses
//   the Home tab, then `dismissTo('/')` again collapses what that navigate pushed. The three actions
//   are queued and applied in order by the router, so they act on each other's result.
// Discarded: resetting the whole navigation state (it would also throw away the state of every
//   other tab) and `replace('/')` (it replaces the focused screen instead of going Home).
//
// Compose: `navController.popBackStack(Home, inclusive = false)` with `launchSingleTop`/`restoreState`;
// SwiftUI: set the `TabView` selection to Home and reset the Home `NavigationPath`.

export type HomeRouter = Readonly<{
  dismissTo: (href: '/') => void;
  navigate: (href: '/') => void;
}>;

export function goHome(router: HomeRouter): void {
  router.dismissTo('/');
  router.navigate('/');
  router.dismissTo('/');
}
