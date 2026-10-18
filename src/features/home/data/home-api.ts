import { baseApi } from '@/core/api/base-api';

import type { HomeData } from '../contracts/home';
import { buildHomeRequest } from './home-request';

/**
 * Development-only fixtures (`EXPO_PUBLIC_HOME_FIXTURE`). The `require` sits in the `__DEV__`
 * branch on purpose: Metro replaces `__DEV__` with `false` in release, folds the branch and never
 * collects the module, so neither the fixtures nor their names ship (H-4). A static `import` would
 * keep them in the bundle even though the fixture is always `undefined` there.
 */
const devFixtures = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- excludes the dev fixtures from release bundles
    (require('./home-fixture-env') as typeof import('./home-fixture-env'))
  : undefined;

/**
 * Home's endpoint. `injectEndpoints` adds it to the single `baseApi`, so Home shares the store,
 * the retry policy and the 60 s / 300 s cache rules with every other endpoint.
 */
export const homeApi = baseApi.injectEndpoints({
  // Fast Refresh re-runs this module and injects the same endpoints again: in development they
  // are replaced silently instead of logging an error each time; in production a duplicated
  // endpoint name stays an error (plan 004, T1, user decision).
  overrideExisting: __DEV__,
  endpoints: (build) => ({
    getHome: build.query<HomeData, void>({
      query: () => buildHomeRequest(devFixtures?.homeFixture, devFixtures?.applyHomeFixture),
      // The base query returns `unknown` (it is shared by every endpoint). `buildHomeRequest`'s
      // `parse` already validated the payload as `HomeData`, so this is the one bounded cast.
      transformResponse: (response) => response as HomeData,
      providesTags: ['Home'],
    }),
  }),
});

export const { useGetHomeQuery } = homeApi;
