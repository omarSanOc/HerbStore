import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';

type RefetchInput = Readonly<{
  isPending: boolean;
  outcome: FetchJsonOutcome<HomeData> | undefined;
}>;

/**
 * An answer exists once a request has settled with something other than a cancellation. The
 * reducer never stores `aborted`, but the rule does not rely on that.
 */
function hasAnswer(outcome: RefetchInput['outcome']): outcome is FetchJsonOutcome<HomeData> {
  return outcome !== undefined && outcome.kind !== 'aborted';
}

/**
 * Pure rule for the automatic refetch when the app returns to the foreground (`AppState` becomes
 * `active`) and Home is the focused screen (the caller checks the focus).
 *
 * It refetches ALWAYS, after a success or after a failure: being away from the app is the moment
 * the data is most likely to be stale. Two cases do not refetch:
 *
 * - A request is in flight (`isPending`). This includes "before the first answer": while the
 *   first load is still running there is nothing to refresh and a second request would only race
 *   the first. If the first request already FAILED, there is an answer (the failure) and the
 *   rule refetches to recover.
 * - No request has settled yet and none is pending (not reachable through `homeRequestReducer`,
 *   which starts pending): there is nothing to repeat.
 */
export function shouldRefetchOnForeground({ isPending, outcome }: RefetchInput): boolean {
  return !isPending && hasAnswer(outcome);
}

/**
 * Pure rule for the automatic refetch when Home regains NAVIGATION focus (back from a product,
 * from the scanner or from another tab).
 *
 * It refetches only to recover from a failure (http, network, timeout, invalid). After a success
 * nothing is repeated, so coming back from a product does not hit the server again (Day 3's RTK
 * Query takes over `refetchOnFocus`/`refetchOnReconnect`). A request in flight is never
 * duplicated, and a screen that has not received any answer yet has nothing to recover from.
 */
export function shouldRefetchOnFocus({ isPending, outcome }: RefetchInput): boolean {
  return !isPending && hasAnswer(outcome) && outcome.kind !== 'ok';
}
