import type { FetchJsonOutcome } from '../network/http.ts';

/**
 * Typed error that every RTK Query endpoint can end with. It is the failure half of
 * `FetchJsonOutcome`, so the whole app speaks one error vocabulary:
 *
 * - `network`: no response at all (offline, server down). The UI shows "offline".
 * - `http`: the server answered non-2xx; `status` tells 4xx from 5xx.
 * - `invalid`: 2xx but the body is not JSON or fails the contract.
 * - `timeout`: no complete answer within the time limit.
 * - `aborted`: we cancelled it (unmount, new request).
 */
export type ApiError =
  | { kind: 'network' }
  | { kind: 'http'; status: number }
  | { kind: 'invalid' }
  | { kind: 'timeout' }
  | { kind: 'aborted' };

export type ApiErrorKind = ApiError['kind'];

/** Shape RTK Query expects from a base query: exactly one of `data` or `error`. */
export type ApiResult<T> = { data: T; error?: undefined } | { error: ApiError; data?: undefined };

export function toBaseQueryResult<T>(outcome: FetchJsonOutcome<T>): ApiResult<T> {
  switch (outcome.kind) {
    case 'ok':
      return { data: outcome.data };
    case 'http':
      return { error: { kind: 'http', status: outcome.status } };
    case 'network':
    case 'invalid':
    case 'timeout':
    case 'aborted':
      return { error: { kind: outcome.kind } };
  }
}

/** Offline in the UI means "fetch failed without any response", not a bad answer. */
export function isOfflineError(error: ApiError | undefined): boolean {
  return error?.kind === 'network';
}

/**
 * RTK Query types the `error` of a hook as `ApiError | SerializedError | undefined`. Our base query
 * only ever produces `ApiError`, but RTK can end an entry with its own shapes (an exception turned
 * into a `SerializedError`, or the `CUSTOM_ERROR` that `retry` returns when a request is aborted).
 * This narrows `unknown` to `ApiError` for the UI: anything that is not one of ours becomes a
 * generic `invalid`, so the screen shows the error state with a manual retry instead of waiting
 * forever. The one exception is the `AbortError` that RTK records when WE call `promise.abort()`
 * (a pull-to-refresh cancelling the next page, T9): that is a cancellation, so it becomes `aborted`
 * and the UI classifiers do not treat it as a failure.
 */
export function toApiError(error: unknown): ApiError | undefined {
  if (error === undefined) {
    return undefined;
  }

  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
    return { kind: 'aborted' };
  }

  if (typeof error === 'object' && error !== null && 'kind' in error) {
    switch (error.kind) {
      case 'network':
      case 'invalid':
      case 'timeout':
      case 'aborted':
        return { kind: error.kind };
      case 'http':
        if ('status' in error && typeof error.status === 'number') {
          return { kind: 'http', status: error.status };
        }
    }
  }

  return { kind: 'invalid' };
}
