import type { BaseQueryApi, BaseQueryFn } from '@reduxjs/toolkit/query';

import { fetchJson, type FetchJsonOutcome, type HttpMethod } from '../network/http.ts';
import { toBaseQueryResult, type ApiError, type ApiResult } from './api-error.ts';

/** What every endpoint's `query` returns: the request plus the validator of its payload. */
export type FetchJsonArgs = {
  /** Path relative to the API origin, e.g. `/products?page=1`. */
  path: string;
  method?: HttpMethod;
  body?: unknown;
  headers?: Readonly<Record<string, string>>;
  /** Validates the decoded JSON against the contract; `undefined` means invalid. */
  parse: (payload: unknown) => unknown;
};

/**
 * What `onSettled` reports for each request. It is built to be safe to log: no query string
 * (a search term is user input), no headers (`Idempotency-Key`) and no body (an address).
 */
export type SettledRequest = {
  method: HttpMethod;
  path: string;
  result: FetchJsonOutcome<unknown>['kind'];
  status?: number;
};

type CreateFetchJsonBaseQueryOptions = {
  /** API origin without a trailing slash. */
  origin: string;
  /** Injection point for tests; defaults to the global `fetch`. */
  fetchImpl?: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;
  timeoutMs?: number | undefined;
  /** Called once per attempt with a log-safe summary. The dev logger is injected from outside. */
  onSettled?: ((event: SettledRequest) => void) | undefined;
};

export type FetchJsonBaseQuery = BaseQueryFn<FetchJsonArgs, unknown, ApiError>;

/**
 * RTK Query base query on top of `fetchJson`. It keeps the `network | http | invalid | timeout |
 * aborted` taxonomy and the per-endpoint contract validation (`parse`), and wires RTK's own
 * `signal` to the request so unsubscribing or a refetch cancels it. Retries are NOT here: they wrap
 * this function with `retry(...)` in `base-api.ts`.
 */
export function createFetchJsonBaseQuery({
  origin,
  fetchImpl,
  timeoutMs,
  onSettled,
}: Readonly<CreateFetchJsonBaseQueryOptions>): FetchJsonBaseQuery {
  return async (args: FetchJsonArgs, api: Pick<BaseQueryApi, 'signal'>) => {
    const method = args.method ?? 'GET';
    const outcome = await fetchJson(`${origin}${args.path}`, {
      method,
      body: args.body,
      headers: args.headers,
      parse: args.parse,
      signal: api.signal,
      timeoutMs,
      fetchImpl,
    });

    onSettled?.({
      method,
      path: args.path.split('?')[0] ?? args.path,
      result: outcome.kind,
      ...(outcome.kind === 'http' ? { status: outcome.status } : {}),
    });

    const result: ApiResult<unknown> = toBaseQueryResult(outcome);
    return result;
  };
}
