/// <reference types="jest" />
// RF-4 (T3a), R-2 (day 3). The global render-error fallback: what it says, that its two actions
// exist with accessible names in both languages, and what each one asks the framework to do.
//
// `retry` is the function expo-router installs on the root error boundary (it clears the error and
// re-renders the failed route). A test passes a `jest.fn` in its place, exactly as the boundary
// does, so the assertion is on what OUR screen asks for.
//
// R-2, decided here: "Reintentar" calls `retry()` and NOTHING else; it never navigates. Where the
// user lands afterwards (the root of the tab, when the failed screen was opened by a link) is the
// framework re-mounting the route, not code of ours. Accepted; see the T3a report.
//
// Compose: an `UncaughtExceptionHandler` that shows a recovery screen. SwiftUI: an `ErrorView`
// shown when a `Result` is `.failure`, with "Try again" calling the same task again.
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render-with-providers';
import { resetRouterMock, router } from '@/test/mock-expo-router';

import { GlobalErrorScreen } from './GlobalErrorScreen';

jest.mock('expo-router', () => jest.requireActual('@/test/mock-expo-router').expoRouterModule);

type Language = 'es' | 'en';

const TEXT = {
  es: {
    title: 'Algo salió mal',
    message: 'Ocurrió un error inesperado al mostrar esta pantalla. Puedes intentarlo de nuevo o volver a Inicio.',
    retry: 'Reintentar',
    goHome: 'Ir al inicio',
  },
  en: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred while showing this screen. You can try again or return to Home.',
    retry: 'Try again',
    goHome: 'Go to Home',
  },
} as const;

describe('GlobalErrorScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetRouterMock();
  });

  describe.each<Language>(['es', 'en'])('in %s', (language) => {
    const text = TEXT[language];

    it('says what happened with a heading, and offers exactly two actions with accessible names', async () => {
      await renderWithProviders(<GlobalErrorScreen retry={jest.fn(() => Promise.resolve())} />, { language });

      expect(screen.getByRole('header', { name: text.title })).toBeOnTheScreen();
      expect(screen.getByText(text.message)).toBeOnTheScreen();
      expect(screen.getAllByRole('button')).toHaveLength(2);
      expect(screen.getByRole('button', { name: text.retry })).toBeEnabled();
      expect(screen.getByRole('button', { name: text.goHome })).toBeEnabled();
    });

    it('"retry" asks the framework to render the failed route again, once, and does not navigate', async () => {
      const retry = jest.fn(() => Promise.resolve());
      await renderWithProviders(<GlobalErrorScreen retry={retry} />, { language });

      await fireEvent.press(screen.getByRole('button', { name: text.retry }));
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(retry).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    });

    it('"go home" clears the error FIRST and only then replaces the route with Home', async () => {
      let finishRetry: () => void = () => undefined;
      const retry = jest.fn(() => new Promise<void>((resolve) => (finishRetry = resolve)));
      await renderWithProviders(<GlobalErrorScreen retry={retry} />, { language });

      await fireEvent.press(screen.getByRole('button', { name: text.goHome }));
      await act(async () => {
        await jest.runAllTimersAsync();
      });
      // The boundary has not been cleared yet: navigating now would unmount a route that still throws.
      expect(retry).toHaveBeenCalledTimes(1);
      expect(router.replace).not.toHaveBeenCalled();

      await act(async () => {
        finishRetry();
        await jest.runAllTimersAsync();
      });
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('is announced as a modal page, so a screen reader does not wander into the failed UI behind it', async () => {
    await renderWithProviders(<GlobalErrorScreen retry={jest.fn(() => Promise.resolve())} />);

    expect(screen.getByRole('header', { name: TEXT.es.title })).toBeOnTheScreen();
    // The page container carries `accessibilityViewIsModal`; find it from the heading's ancestry.
    let node = screen.getByRole('header', { name: TEXT.es.title }).parent;
    let modal = false;
    while (node) {
      if (node.props.accessibilityViewIsModal === true) modal = true;
      node = node.parent;
    }
    expect(modal).toBe(true);
  });
});
