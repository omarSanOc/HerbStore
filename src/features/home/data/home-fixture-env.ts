import { resolveHomeFixture } from './home-fixtures';

// Metro inlines `EXPO_PUBLIC_*` only for the literal `process.env.EXPO_PUBLIC_HOME_FIXTURE`
// expression, and `__DEV__` is false in release bundles: the fixture is always `undefined` there.
/** Fixture selected for this run of the app, development only. */
export const homeFixture = resolveHomeFixture({
  isDev: __DEV__,
  raw: process.env.EXPO_PUBLIC_HOME_FIXTURE,
});
