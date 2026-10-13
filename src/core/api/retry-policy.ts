import type { ApiError } from './api-error.ts';

/** RF-8: exactly two automatic retries, so a failing read makes three requests in total. */
export const MAX_AUTOMATIC_RETRIES = 2;

const FIRST_RETRY_DELAY_MS = 500;

type ShouldRetryInput = {
  error: ApiError;
  /** Failed attempts so far: 1 after the first failure, 2 after the second... */
  attempt: number;
  /** HTTP method of the request; `undefined` means a plain read (`GET`). */
  method?: string | undefined;
  maxRetries: number;
};

/**
 * Pure retry decision. Only reads are retried, and only when repeating them can help:
 *
 * - `network` and `http` 5xx: transient, the server may be back in a second.
 * - `http` 4xx: the request itself is wrong; repeating it returns the same answer.
 * - `timeout`: it does not prove the server did not process it, and the user already waited 8 s.
 * - `invalid`: the contract is broken; repeating it does not repair the payload.
 * - `aborted`: we cancelled it on purpose.
 * - any method other than `GET`: a write may have been processed, so replaying it is not safe.
 */
export function shouldRetryRequest({ error, attempt, method, maxRetries }: ShouldRetryInput) {
  if (attempt > maxRetries) {
    return false;
  }

  if (method !== undefined && method.toUpperCase() !== 'GET') {
    return false;
  }

  return error.kind === 'network' || (error.kind === 'http' && error.status >= 500);
}

/** Deterministic exponential backoff: 500 ms before the first retry, 1000 ms before the second. */
export function retryDelayMs(attempt: number): number {
  return FIRST_RETRY_DELAY_MS * 2 ** (Math.max(attempt, 1) - 1);
}
