import { baseApi } from '@/core/api/base-api';

import type { HomeData } from '../contracts/home';
import { homeFixture } from './home-fixture-env';
import { buildHomeRequest } from './home-request';

/**
 * Home's endpoint. `injectEndpoints` adds it to the single `baseApi`, so Home shares the store,
 * the retry policy and the 60 s / 300 s cache rules with every other endpoint.
 */
export const homeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getHome: build.query<HomeData, void>({
      query: () => buildHomeRequest(homeFixture),
      // The base query returns `unknown` (it is shared by every endpoint). `buildHomeRequest`'s
      // `parse` already validated the payload as `HomeData`, so this is the one bounded cast.
      transformResponse: (response) => response as HomeData,
      providesTags: ['Home'],
    }),
  }),
});

export const { useGetHomeQuery } = homeApi;
