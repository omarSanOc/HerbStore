import type { OrderRequest, OrderResult } from '../contracts/order.ts';

/**
 * Log-safe summaries of an order attempt (`__DEV__` only). Decision: the Idempotency-Key MAY be
 * logged, truncated, because validating "same key in the 202 and in the 200" needs it; the body and
 * the address never are. Only product ids appear: they are catalog data, not personal data.
 */

/** The last 4 characters: two POSTs of one attempt show the same tail, two attempts differ. */
export function maskIdempotencyKey(key: string): string {
  return key.length > 4 ? `…${key.slice(-4)}` : '…';
}

/**
 * One line per successful answer, e.g. `POST /orders -> 202 pending retryAfter=1s key=…2c3d
 * products=p1,p2`. The HTTP status is implied by the projected answer (the contract maps 202 to
 * `pending` and 200 to `confirmed`). Failures are already logged by the base query (`[api] ...`).
 */
export function describeOrderForLog(
  idempotencyKey: string,
  request: OrderRequest,
  result: OrderResult,
): string {
  const outcome =
    result.status === 'pending'
      ? `202 pending retryAfter=${result.retryAfterSeconds}s`
      : '200 confirmed';
  const products = request.items.map(({ productId }) => productId).join(',');

  return `POST /orders -> ${outcome} key=${maskIdempotencyKey(idempotencyKey)} products=${products}`;
}
