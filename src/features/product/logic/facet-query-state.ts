import type { ApiError } from '../../../core/api/api-error.ts';

/**
 * What the advanced-filters panel renders for one facet (brands, subcategories): the matrix of
 * RF-30 as a discriminated union, so the component `switch`es on `status` and the compiler checks
 * every case. `stale` carries the options that must NOT be thrown away.
 *
 * Android: a `sealed interface FacetUiState` produced by the ViewModel. SwiftUI: an enum with an
 * associated `options`, rendered by one `switch`. Same idea, same exhaustiveness.
 */
export type FacetQueryState<T> =
  | { status: 'loading' }
  | { status: 'ready'; options: readonly T[] }
  | { status: 'empty' }
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'stale'; options: readonly T[] };

/** The states that show a message instead of options (the panel is never a dead end). */
export type FacetProblemState = Extract<
  FacetQueryState<unknown>,
  { status: 'loading' } | { status: 'empty' } | { status: 'offline' } | { status: 'error' }
>;

/**
 * What the RTK Query hook knows about ONE facet, reduced to the three facts the rule needs:
 *
 * - `currentData`: the options of the CURRENT args, i.e. of the current language. `data` would keep
 *   the previous language's options while the new ones load, and the panel would print names of a
 *   language the screen is no longer in (RF-24, RNF-3).
 * - `error`: the failure of the latest settled request, narrowed with `toApiError`. RTK keeps it
 *   while the next request is pending and clears it only on success.
 * - `isFetching`: a request (first load, retry or revalidation) is in flight.
 */
export type FacetQuerySnapshot<T> = Readonly<{
  currentData: readonly T[] | undefined;
  error: ApiError | undefined;
  isFetching: boolean;
}>;

/**
 * Pure rule that turns the query snapshot into a panel state (RF-23, RF-30, RF-34). It follows
 * `classifyHomeResult` and `classifyProductListState`:
 *
 * - Options of the current entry: `ready`; a valid empty array is `empty` (the panel says "no
 *   options" and stays operable, never an endless loading).
 * - Failure without options: `offline` when fetch failed without a response (`network`), `error`
 *   for 4xx/5xx/timeout/invalid body. While the retry is in flight the panel shows `loading` again,
 *   so a settled failure never blinks over a fresh attempt. A cancellation (`aborted`) is not a
 *   failure.
 * - Options plus a settled failure: `stale`, keeping them with the "update failed" notice (RF-30).
 *   The notice also stays while the retry runs, exactly like Home's: RTK keeps the old error until
 *   a success clears it, so hiding it earlier would make it flicker.
 * - An empty array plus a failure is a failure screen: there are no options to preserve.
 */
export function classifyFacetQueryState<T>({
  currentData,
  error,
  isFetching,
}: FacetQuerySnapshot<T>): FacetQueryState<T> {
  const failure = error === undefined || error.kind === 'aborted' ? undefined : error;
  const usable = currentData !== undefined && currentData.length > 0 ? currentData : undefined;
  const shownFailure = isFetching && currentData === undefined ? undefined : failure;

  if (shownFailure !== undefined) {
    if (usable !== undefined) {
      return { status: 'stale', options: usable };
    }

    return shownFailure.kind === 'network' ? { status: 'offline' } : { status: 'error' };
  }

  if ((isFetching || currentData === undefined) && usable === undefined) {
    return { status: 'loading' };
  }

  return usable === undefined ? { status: 'empty' } : { status: 'ready', options: usable };
}
