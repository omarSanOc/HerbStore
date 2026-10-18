/// <reference types="jest" />
// An explicit, minimal stand-in for `expo-router` in component tests.
//
// A test file installs it with
//   jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);
// and calls `resetRouterMock()` in `beforeEach`. The router is then a set of `jest.fn`s, so a test
// asserts WHAT THE USER'S TAP ASKED FOR (`router.push` called once with this href), which is the
// contract of our components. It does not run a real navigator: how the stack reacts to two
// `push` calls is expo-router's job and is checked on devices.
//
// Compose: a `TestNavHostController` whose `navigate` calls you verify. SwiftUI: a recording
// `NavigationPath` binding.

export const router = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  dismissTo: jest.fn(),
  canGoBack: jest.fn((): boolean => true),
};

/**
 * The Tabs navigator as `useNavigation('/(tabs)')` returns it: the empty cart's "Go to Home" reads
 * its state and dispatches actions. The state has Home at its root and the Cart tab focused.
 */
export const TABS_STATE = {
  key: 'tabs-key',
  index: 2,
  routes: [
    { name: '(home)', state: { key: 'home-stack-key', routes: [{ name: 'index' }] } },
    { name: '(categories)' },
    { name: '(cart)', state: { key: 'cart-stack-key', routes: [{ name: 'cart' }] } },
    { name: '(account)' },
  ],
};
export const tabsNavigation = { getState: jest.fn(() => TABS_STATE), dispatch: jest.fn() };

/**
 * The ROOT Stack as `useNavigation()` (no argument) returns it inside `+not-found`: `(tabs)` with a
 * product stacked on Home, and the not-found screen on top. A test that needs another shape sets
 * `rootNavigation.getState.mockReturnValue(...)`.
 */
export const ROOT_STATE = {
  key: 'root-key',
  index: 1,
  routes: [
    {
      name: '(tabs)',
      state: {
        ...TABS_STATE,
        index: 0,
        routes: [
          { name: '(home)', state: { key: 'home-stack-key', routes: [{ name: 'index' }, { name: 'product/[id]' }] } },
          ...TABS_STATE.routes.slice(1),
        ],
      },
    },
    { name: '+not-found' },
  ],
};
export const rootNavigation = { getState: jest.fn(() => ROOT_STATE), dispatch: jest.fn() };

/** Navigation focus as `useIsFocused()` reports it; a test flips it with `setFocused`. */
let focused = true;
export const setFocused = (value: boolean) => {
  focused = value;
};

/** Clears the calls AND restores the default answers (`restoreAllMocks` would drop them). */
export function resetRouterMock() {
  for (const fn of Object.values(router)) fn.mockReset();
  router.canGoBack.mockReturnValue(true);
  tabsNavigation.getState.mockReset();
  tabsNavigation.getState.mockReturnValue(TABS_STATE);
  tabsNavigation.dispatch.mockReset();
  rootNavigation.getState.mockReset();
  rootNavigation.getState.mockReturnValue(ROOT_STATE);
  rootNavigation.dispatch.mockReset();
  focused = true;
}

export const expoRouterModule = {
  useRouter: () => router,
  useIsFocused: () => focused,
  // `useNavigation()` is the screen's own navigator (the root Stack in `+not-found`); a parent href
  // (`'/(tabs)'`) reaches the Tabs navigator, as in expo-router.
  useNavigation: (parent?: string) => (parent === undefined ? rootNavigation : tabsNavigation),
  useLocalSearchParams: () => ({}),
};
