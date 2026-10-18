import { applyHomeFixture, resolveHomeFixture } from './home-fixtures';

// DEVELOPMENT ONLY. `home-api.ts` reaches this module with a `require` under `__DEV__`, so Metro
// drops it (and `home-fixtures.ts`) from release bundles; `src/test/production-bundle-audit.test.ts`
// keeps it that way. Metro inlines `EXPO_PUBLIC_*` only for the literal
// `process.env.EXPO_PUBLIC_HOME_FIXTURE` expression.
/** Fixture selected for this run of the app, development only. */
export const homeFixture = resolveHomeFixture({
  isDev: __DEV__,
  raw: process.env.EXPO_PUBLIC_HOME_FIXTURE,
});

export { applyHomeFixture };
