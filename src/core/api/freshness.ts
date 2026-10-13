/** RF-5: a successful answer is fresh for 60 seconds. */
export const FRESH_MS = 60_000;

type FreshnessInput = {
  /** `fulfilledTimeStamp` of the RTK Query entry; `undefined` until the first success. */
  fulfilledTimeStamp: number | undefined;
  now: number;
  isFetching: boolean;
};

/**
 * Pure rule shared by every automatic trigger (navigation focus, returning to the foreground,
 * network reconnection): revalidate once, in the background, only when the data is stale.
 *
 * - No successful answer yet: nothing to revalidate. A screen without data stays in its
 *   loading/offline/error state and offers the manual retry (RF-8).
 * - A request already in flight: do not stack another one.
 * - Less than 60 s old: fresh, served without touching the network.
 */
export function shouldRevalidate({ fulfilledTimeStamp, now, isFetching }: FreshnessInput): boolean {
  if (isFetching || fulfilledTimeStamp === undefined) {
    return false;
  }

  return now - fulfilledTimeStamp >= FRESH_MS;
}
