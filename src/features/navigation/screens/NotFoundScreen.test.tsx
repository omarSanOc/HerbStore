/// <reference types="jest" />
// RF-7, RF-12 (T4b). The unrecognized-link screen (`herbstore://<unknown>`) and the 404 of a product
// or a category share one screen but NOT one exit:
//   - `+not-found` lives in the ROOT Stack, above `(tabs)`: "Go to Home" must leave Home selected at
//     its root (no stacked detail, no second Home) by dispatching the pure plan of
//     `home-root-plan.ts` to the root navigator. `router.dismissTo('/')` created a new Home there;
//   - a 404 INSIDE a tab stack (product, category) keeps its validated Day 5 exit: `dismissTo('/')`.
// The real stack reaction is checked on devices; here the assertion is on WHAT THE TAP ASKS FOR.
//
// Compose: `navController.popBackStack(HomeRoute, inclusive = false)` + select the Home item.
// SwiftUI: reset the root `NavigationPath` and set the `TabView` selection to `.home`.
import { fireEvent, screen } from '@testing-library/react-native';

import NotFoundRoute from '@/app/+not-found';
import { ROOT_STATE, resetRouterMock, rootNavigation, router, tabsNavigation } from '@/test/mock-expo-router';
import { renderWithProviders } from '@/test/render-with-providers';

import { NotFoundScreen } from './NotFoundScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    linkTitle: 'Enlace no reconocido',
    linkMessage: 'Este enlace no corresponde a una pantalla de HerbStore.',
    genericTitle: 'No encontramos esta pantalla',
    back: 'Volver',
    goHome: 'Ir a Inicio',
  },
  en: {
    linkTitle: 'Link not recognized',
    linkMessage: 'This link does not match a HerbStore screen.',
    genericTitle: "We couldn't find this screen",
    back: 'Go back',
    goHome: 'Go to Home',
  },
} as const;

const HOME_STACK_KEY = 'home-stack-key';
const TABS_KEY = 'tabs-key';
const ROOT_KEY = 'root-key';

beforeEach(() => {
  resetRouterMock();
});

describe.each<Language>(['es', 'en'])('unrecognized link (+not-found) in %s', (language) => {
  const text = TEXT[language];

  it('says the link is not recognized and offers two named actions', async () => {
    await renderWithProviders(<NotFoundRoute />, { language });

    expect(screen.getByRole('header', { name: text.linkTitle })).toBeOnTheScreen();
    expect(screen.getByText(text.linkMessage)).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: text.back })).toBeEnabled();
    expect(screen.getByRole('button', { name: text.goHome })).toBeEnabled();
  });

  it('"Go to Home" with a product stacked on Home: pops Home, selects the tab, then pops the root, in that order', async () => {
    await renderWithProviders(<NotFoundRoute />, { language });

    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

    expect(rootNavigation.dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: 'POP_TO_TOP', target: HOME_STACK_KEY },
      { type: 'JUMP_TO', payload: { name: '(home)' }, target: TABS_KEY },
      { type: 'POP_TO_TOP', target: ROOT_KEY },
    ]);
    // The old exit created a second Home over the detail; it must be gone from this screen.
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(tabsNavigation.dispatch).not.toHaveBeenCalled();
  });

  it('"Go to Home" with Home already at its root and the Cart tab active: selects Home and pops the root, no Home pop', async () => {
    rootNavigation.getState.mockReturnValue({
      ...ROOT_STATE,
      routes: [
        {
          ...ROOT_STATE.routes[0],
          state: {
            ...ROOT_STATE.routes[0].state!,
            index: 2,
            routes: [
              { name: '(home)', state: { key: HOME_STACK_KEY, routes: [{ name: 'index' }] } },
              ...ROOT_STATE.routes[0].state!.routes.slice(1),
            ],
          },
        },
        ROOT_STATE.routes[1],
      ],
    });
    await renderWithProviders(<NotFoundRoute />, { language });

    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

    expect(rootNavigation.dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: 'JUMP_TO', payload: { name: '(home)' }, target: TABS_KEY },
      { type: 'POP_TO_TOP', target: ROOT_KEY },
    ]);
  });

  it('a second tap plans from the state the first one left: it only selects the tab again', async () => {
    await renderWithProviders(<NotFoundRoute />, { language });
    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));
    rootNavigation.dispatch.mockClear();
    rootNavigation.getState.mockReturnValue({
      ...ROOT_STATE,
      routes: [
        {
          ...ROOT_STATE.routes[0],
          state: {
            ...ROOT_STATE.routes[0].state!,
            routes: [
              { name: '(home)', state: { key: HOME_STACK_KEY, routes: [{ name: 'index' }] } },
              ...ROOT_STATE.routes[0].state!.routes.slice(1),
            ],
          },
        },
      ],
    });

    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

    expect(rootNavigation.dispatch.mock.calls.map(([action]) => action)).toEqual([
      { type: 'JUMP_TO', payload: { name: '(home)' }, target: TABS_KEY },
    ]);
  });

  it('without a (tabs) route in the root state it replaces the route with "/" instead of dispatching', async () => {
    rootNavigation.getState.mockReturnValue({ key: ROOT_KEY, index: 0, routes: [{ name: '+not-found' }] } as never);
    await renderWithProviders(<NotFoundRoute />, { language });

    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

    expect(rootNavigation.dispatch).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('"Go back" goes back one screen (and never to Home)', async () => {
    await renderWithProviders(<NotFoundRoute />, { language });

    await fireEvent.press(screen.getByRole('button', { name: text.back }));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(rootNavigation.dispatch).not.toHaveBeenCalled();
  });
});

describe.each<Language>(['es', 'en'])('404 inside a tab stack (product, category) in %s', (language) => {
  const text = TEXT[language];

  it('keeps its Day 5 exit: "Go to Home" is dismissTo("/") and touches no navigator', async () => {
    await renderWithProviders(<NotFoundScreen />, { language });

    expect(screen.getByRole('header', { name: text.genericTitle })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: text.goHome }));

    expect(router.dismissTo).toHaveBeenCalledTimes(1);
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(rootNavigation.dispatch).not.toHaveBeenCalled();
    expect(tabsNavigation.dispatch).not.toHaveBeenCalled();
  });
});
