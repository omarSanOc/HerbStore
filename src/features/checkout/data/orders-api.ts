import { baseApi } from '@/core/api/base-api';

import type { OrderRequest, OrderResult } from '../contracts/order';
import { parseOrderResult } from '../contracts/parse-order-result';
import { parseApiOrderError } from '../contracts/parse-order-error';
import { tagsForOrderResult } from '../logic/order-invalidation';
import { describeOrderForLog } from '../logic/order-log';

/**
 * What a caller gives to `createOrder`. The key is created by the CALLER, once per attempt, and
 * passed again unchanged on every re-POST of that attempt: this is what makes the repetition safe.
 */
export type CreateOrderArg = Readonly<{
  idempotencyKey: string;
  request: OrderRequest;
}>;

/**
 * The orders endpoint. `injectEndpoints` adds it to the single `baseApi`, so it shares the store
 * and the base query; Day 4's real checkout reuses it (and adds `GET /orders/status/:key` and the
 * 4xx bodies).
 *
 * - `createOrder` is a MUTATION: it writes, it has no cache entry to read back, and it declares
 *   which cached READS it makes stale (`invalidatesTags`).
 * - 0 automatic retries (P2). `shouldRetryRequest` never replays a method other than `GET`, whatever
 *   the error: a `POST` that failed by network or timeout may have been processed, and replaying it
 *   blind is the mistake the idempotency key and the Day 4 status query exist to avoid.
 */
export const ordersApi = baseApi.injectEndpoints({
  // Fast Refresh re-runs this module and injects the same endpoints again: in development they
  // are replaced silently instead of logging an error each time; in production a duplicated
  // endpoint name stays an error (plan 004, T1, user decision).
  overrideExisting: __DEV__,
  endpoints: (build) => ({
    createOrder: build.mutation<OrderResult, CreateOrderArg>({
      query: ({ idempotencyKey, request }) => ({
        path: '/orders',
        method: 'POST',
        body: request,
        headers: { 'Idempotency-Key': idempotencyKey },
        parse: parseOrderResult,
        parseErrorBody: (status, payload) => parseApiOrderError(status, payload, idempotencyKey),
      }),
      // Shared base query returns `unknown`; `parseOrderResult` already validated and projected the
      // payload to exactly `OrderResult`, so this is the one bounded cast. The log runs here (not
      // in `query`) because only now is the answer known; it prints no body and no address.
      transformResponse: (response, _meta, { idempotencyKey, request }) => {
        const result = response as OrderResult;
        if (__DEV__) {
          console.log(`[orders] ${describeOrderForLog(idempotencyKey, request, result)}`);
        }
        return result;
      },
      // RTK calls it with `(result, error, arg)`. `result` is `undefined` on failure, so a failed
      // or still-pending order invalidates nothing; `arg` carries the products that were ordered.
      invalidatesTags: (result, _error, { request }) => tagsForOrderResult(result, request.items),
    }),
    getOrderStatus: build.query<OrderResult, string>({
      query: (idempotencyKey) => ({
        path: `/orders/status/${encodeURIComponent(idempotencyKey)}`,
        parse: parseOrderResult,
        parseErrorBody: (status, payload) => parseApiOrderError(status, payload, idempotencyKey),
      }),
      keepUnusedDataFor: 0,
      providesTags: [],
    }),
  }),
});

export const { useCreateOrderMutation, useGetOrderStatusQuery } = ordersApi;
