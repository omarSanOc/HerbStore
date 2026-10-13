import { createApi, retry } from '@reduxjs/toolkit/query/react';

import { apiOrigin } from '@/core/network/api-origin';

import type { ApiError } from './api-error';
import { createFetchJsonBaseQuery, type FetchJsonArgs } from './fetch-json-base-query';
import { MAX_AUTOMATIC_RETRIES, retryDelayMs, shouldRetryRequest } from './retry-policy';

/**
 * Log-safe, one line per ATTEMPT (a read that fails with a 503 prints three lines: 1 + 2 retries).
 * Method, path without query string and outcome only: no headers, no body, no search terms.
 */
const baseQuery = createFetchJsonBaseQuery({
  origin: apiOrigin,
  onSettled: __DEV__
    ? ({ method, path, result, status }) => {
        console.log(`[api] ${method} ${path} -> ${result}${status === undefined ? '' : ` ${status}`}`);
      }
    : undefined,
});

/** Same shape as RTK's default backoff, but deterministic: 500 ms, then 1000 ms. */
function backoff(attempt: number, _maxRetries: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(new Error('Aborted'));
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, retryDelayMs(attempt));
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/*
 * RTK's `retry` takes EITHER `maxRetries` OR `retryCondition` (the types forbid both), and a custom
 * condition replaces the built-in limit. So the limit lives inside `shouldRetryRequest`
 * (`MAX_AUTOMATIC_RETRIES`), and the condition reads the HTTP method from the request args: only
 * reads are replayed (RF-8).
 */
const baseQueryWithRetry = retry(baseQuery, {
  retryCondition: (error, args, { attempt }) =>
    shouldRetryRequest({
      error: error as ApiError,
      attempt,
      method: (args as FetchJsonArgs).method,
      maxRetries: MAX_AUTOMATIC_RETRIES,
    }),
  backoff,
});

/**
 * The one RTK Query API of the app. Features add their endpoints with `baseApi.injectEndpoints`, so
 * the store has a single reducer and middleware and every endpoint shares the same cache policy:
 *
 * - `keepUnusedDataFor: 300`: an entry nobody is subscribed to survives 5 minutes, so reopening a
 *   screen after more than 60 s still shows the cache while it revalidates (RF-5).
 * - `refetchOnMountOrArgChange: 60`: opening a screen refetches only if its data is 60 s old or
 *   more; younger data is served from the cache without network.
 * - `refetchOnFocus` / `refetchOnReconnect`: OFF. They ignore the 60 s and rely on web events that
 *   do not exist in React Native; `useRevalidateWhenStale` applies the same rule instead.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Home', 'ProductList', 'Product'],
  keepUnusedDataFor: 300,
  refetchOnMountOrArgChange: 60,
  refetchOnFocus: false,
  refetchOnReconnect: false,
  endpoints: () => ({}),
});
