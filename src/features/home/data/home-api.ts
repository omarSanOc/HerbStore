import { baseApi } from '@/core/api/base-api';
import type { SupportedLanguage } from '@/core/i18n/languages';

import type { HomeData } from '../contracts/home';
import { buildHomeRequest } from './home-request';

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
    /**
     * The language is the ARGUMENT, hence the cache identity: `getHome('es')` and `getHome('en')`
     * are two entries with two in-flight requests, and a late Spanish answer can only write the
     * Spanish one (RF-24). The hook passes the CURRENT language (`useCurrentLanguage`); nothing
     * reads a mutable singleton here, and the payload is never mixed across languages.
     */
    getHome: build.query<HomeData, SupportedLanguage>({
      query: (language) => buildHomeRequest(language),
      // The base query returns `unknown` (it is shared by every endpoint). `buildHomeRequest`'s
      // `parse` already validated the payload as `HomeData`, so this is the one bounded cast.
      transformResponse: (response) => response as HomeData,
      providesTags: ['Home'],
    }),
  }),
});

export const { useGetHomeQuery } = homeApi;
