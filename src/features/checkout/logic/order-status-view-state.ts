import type { ApiError } from '../../../core/api/api-error.ts';
import type { OrderResult } from '../contracts/order.ts';
import type { AttemptState } from './attempt-machine.ts';

/** The only attempts this view exists for: an `idle` one never reaches the screen (it redirects). */
export type ActiveAttempt = Extract<AttemptState, { status: 'preliminary' | 'unresolved' }>;

/**
 * What the screen knows about the LATEST consult, reduced to the three facts the rule needs
 * (the same snapshot shape as `HomeQuerySnapshot` / `FacetQuerySnapshot`):
 *
 * - `data`: the answer AFTER `parseOrderResult`, i.e. only the contractual pairs of RF-17/RF-19
 *   (200+confirmed, 202+pending). A body that broke the contract never arrives here; it is
 *   `error` with kind `invalid` or an http failure.
 * - `error`: the failure of that consult, narrowed with `toApiError`.
 * - `isFetching`: a consult is in flight right now (`busy` on the screen).
 *
 * `data` and `error` describe ONE settled consult (the screen stores them together); a stale
 * failure never sits beside a newer answer, and if it ever did, the contract answer wins.
 */
export type OrderStatusSnapshot = Readonly<{
  data: OrderResult | undefined;
  error: ApiError | undefined;
  isFetching: boolean;
}>;

/**
 * What the order-status screen presents (RF-33): one state, never a partial order presented as
 * valid (RNF-7). `confirmed` exists so the rule can SAY it; the screen never paints it — it leaves
 * for the confirmation, which owns that copy.
 *
 * - `loading`: the consult is in flight, no answer settled yet.
 * - `pending`: 202+pending with `retryAfterSeconds`, or the `pending` belief persisted locally.
 * - `offline`: the transport answered nothing at all (`network`), the app-wide word for it.
 * - `error`: 5xx, timeout, invalid body, a 4xx the contract does not know (422 among them) or a
 *   pair whose body does not match. Safe copy only: it never echoes the key or the input (RF-34).
 * - `unresolved`: the base view — no settled answer, or a contract answer that neither confirms
 *   nor (here) releases. The attempt lock itself is `attempt-machine`'s job, not this rule's.
 *
 * There is no `empty` and no `stale` for an order (RF-33): a read of an order cannot be "empty",
 * and nothing stale is ever promoted to a result.
 */
export type OrderStatusViewState =
  | { status: 'loading' }
  | { status: 'pending'; retryAfterSeconds?: number }
  | { status: 'confirmed' }
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'unresolved' };

/** The error bodies `parseOrderError` recognised as one of the spec 004 pairs (RF-17–RF-19). */
const CONTRACT_ERROR_KINDS: ReadonlySet<string> = new Set([
  'validation',
  'outOfStock',
  'keyReused',
  'notCreated',
  'expired',
]);

function isContractErrorBody(body: unknown): boolean {
  return typeof body === 'object' && body !== null && 'kind' in body &&
    typeof (body as { kind: unknown }).kind === 'string' &&
    CONTRACT_ERROR_KINDS.has((body as { kind: string }).kind);
}

/**
 * A settled FAILURE worth a line on screen, or `undefined` when the failure carries no news:
 * a cancellation (`aborted`) and a contractual answer (404 not_created, 410 expired, 409
 * key_reused, 400 validation, 409 out_of_stock) leave the local belief in charge — they are
 * handled by the machine (which releases only on those pairs) and by RF-17–RF-19, not by copy.
 */
function viewOfFailure(error: ApiError): 'offline' | 'error' | undefined {
  switch (error.kind) {
    case 'network':
      return 'offline';
    case 'http':
      // 5xx first: the gateway answer may even be a body the contract recognises, and a server
      // failure is never a contract pair for a status consult (RF-33).
      if (error.status >= 500) return 'error';
      return isContractErrorBody(error.body) ? undefined : 'error';
    case 'timeout':
    case 'invalid':
      return 'error';
    case 'aborted':
      return undefined;
  }
}

/**
 * Pure rule that turns the settled consult plus the LOCAL attempt into the state the screen
 * presents (RF-33, RF-34, RF-20). Order matters and mirrors `classifyHomeResult`:
 *
 * 1. A consult in flight: `loading`. A retry never blinks over the failure it is retrying.
 * 2. A settled answer: only the two contractual pairs of RF-17 produce `confirmed`/`pending`
 *    (with the seconds to wait); anything else in `data` is an incompatible body -> `error`.
 * 3. A settled failure: `network` -> `offline`; 5xx, timeout, invalid and unknown 4xx (422
 *    included) -> `error`; a recognised contract pair or a cancellation -> no line, fall through.
 * 4. Nothing new: the persisted `pending` belief, else the `unresolved` base.
 *
 * It never releases the attempt, never invents an order and never echoes the key or any input.
 */
export function classifyOrderStatusView({
  attempt,
  snapshot,
}: Readonly<{ attempt: ActiveAttempt; snapshot: OrderStatusSnapshot }>): OrderStatusViewState {
  const { data, error, isFetching } = snapshot;

  if (isFetching) return { status: 'loading' };

  if (data !== undefined) {
    switch (data.status) {
      case 'confirmed': {
        // Defence in depth for RF-20: the parser already refuses a confirmed without its order,
        // and the view refuses it too — nothing here can ever say "confirmed" about a broken pair.
        const orderId: string | undefined = data.orderId;
        return orderId !== undefined && orderId.length > 0 ? { status: 'confirmed' } : { status: 'error' };
      }
      case 'pending':
        // RF-19: `retryAfterSeconds` is an integer of at least one; anything else is not the pair.
        return data.retryAfterSeconds >= 1
          ? { status: 'pending', retryAfterSeconds: data.retryAfterSeconds }
          : { status: 'error' };
      default:
        // RF-20: an object that is not one of the two pairs is not an order result.
        return { status: 'error' };
    }
  }

  if (error !== undefined) {
    const explicit = viewOfFailure(error);
    if (explicit !== undefined) return { status: explicit };
  }

  return attempt.remoteStatus === 'pending' ? { status: 'pending' } : { status: 'unresolved' };
}
