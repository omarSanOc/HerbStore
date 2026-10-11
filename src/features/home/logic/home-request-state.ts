import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';
import { classifyHomeResult, type HomeScreenState } from './classify-home-result.ts';

/**
 * Everything `useHome` remembers about its requests. The rest (what to draw) is derived from it.
 *
 * - `requestId`: identity of the request whose answer counts. Every answer carries the id of the
 *   request that produced it, so a late answer of an older request is recognised and dropped.
 * - `data`: the last successfully received payload, kept to survive a failed refresh.
 * - `outcome`: how the most recent finished request ended (kept while the next one is pending, so
 *   the offline notice does not flicker during a pull-to-refresh).
 */
export type HomeRequestState = Readonly<{
  requestId: number;
  isPending: boolean;
  data: HomeData | undefined;
  outcome: FetchJsonOutcome<HomeData> | undefined;
}>;

export type HomeRequestAction =
  | { type: 'refetch' }
  | { type: 'settled'; requestId: number; outcome: FetchJsonOutcome<HomeData> };

/** The first request starts with the screen: no setState in an effect is needed to begin it. */
export const initialHomeRequestState: HomeRequestState = {
  requestId: 1,
  isPending: true,
  data: undefined,
  outcome: undefined,
};

export function homeRequestReducer(
  state: HomeRequestState,
  action: HomeRequestAction,
): HomeRequestState {
  switch (action.type) {
    case 'refetch':
      // One request at a time: a second trigger (pull, foreground, focus) while one is in flight
      // changes nothing, so there are never two answers racing for the same screen.
      return state.isPending ? state : { ...state, requestId: state.requestId + 1, isPending: true };
    case 'settled':
      // Stale (older request, duplicate) or cancelled answers are discarded.
      if (
        !state.isPending ||
        action.requestId !== state.requestId ||
        action.outcome.kind === 'aborted'
      ) {
        return state;
      }
      return {
        ...state,
        isPending: false,
        outcome: action.outcome,
        data: action.outcome.kind === 'ok' ? action.outcome.data : state.data,
      };
  }
}

/** Derived during render from the remembered facts; nothing here is stored. */
export function selectHomeScreenState({
  data,
  isPending,
  outcome,
}: HomeRequestState): HomeScreenState {
  if (!isPending) {
    return classifyHomeResult(data, outcome);
  }

  // While a request is in flight, keep showing the notice of a previous failure over the data.
  // Without data (first load retried) or after a success, `undefined` means "waiting": the
  // skeleton, not the failure screen again.
  const keepsFailure = data !== undefined && outcome !== undefined && outcome.kind !== 'ok';
  return classifyHomeResult(data, keepsFailure ? outcome : undefined);
}

/** The pull indicator only spins over visible data; the first load shows the skeleton instead. */
export function selectIsRefreshing(state: HomeRequestState): boolean {
  return state.isPending && selectHomeScreenState(state).status === 'ready';
}
