/// <reference types="jest" />
// Runs once per test file, before the tests (and before any app module is imported).
// Imported first on purpose: RNTL registers its own `afterEach(cleanup)` on import, and it must run
// BEFORE the hook below, so the language reset never re-renders a component that is still mounted.
import '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { i18n } from '@/core/i18n';

// The app refuses to start without an API origin (`PublicConfigGate`); tests use a fake host that
// no code can reach: `mock-fetch.ts` answers every request, so nothing touches the network.
process.env.EXPO_PUBLIC_API_ORIGIN = 'http://api.test';

// Native/animation libraries have official Jest mocks; the real ones need the native runtime.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

// The notification adapter is the boundary to `expo-notifications` (a native module that Jest cannot
// run, and which warns when it believes it is in Expo Go). The real scheduling is checked on
// devices; a test that needs another result replaces this with `jest.spyOn` on the module.
jest.mock('@/features/notifications/native/order-notifications', () => ({
  scheduleOrderNotification: async () => ({ kind: 'scheduled', identifier: 'test-notification' }),
}));

// The app's `__DEV__` tags (`[api] GET /brands -> ok`, `[products] ...`) would flood the report.
// Anything else (a real `console.log`, warnings, errors) still prints.
beforeEach(() => {
  const log = console.log.bind(console);
  jest.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && /^\[[a-z-]+\] /.test(args[0])) return;
    log(...args);
  });

  // `ReanimatedSwipeable` (cart rows) builds its gestures from node_modules code that the Jest
  // transform does not run through the worklets plugin, so Gesture Handler's DEV check sees "some
  // callbacks are worklets and some are not" on every mount. It is about how the LIBRARY is
  // compiled, not about our code (on a device the plugin runs and the check is silent), and a swipe
  // cannot be driven from Jest anyway. Only that exact message is dropped; any other error prints.
  const error = console.error.bind(console);
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('callbacks in the gesture are worklets and some are not')) return;
    error(...args);
  });
});

afterEach(async () => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  // The i18n instance is a module singleton: every test starts in Spanish.
  await i18n.changeLanguage('es');
});
