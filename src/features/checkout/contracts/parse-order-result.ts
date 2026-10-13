import { isRecord, isText } from '../../../core/validation/json-guards.ts';
import type { OrderResult } from './order.ts';

/**
 * Validates a 2xx answer of `POST /orders` and keeps only what the app needs (see `OrderResult`).
 * Anything else, including a `status` this version does not know, is `undefined`, which the HTTP
 * layer reports as `invalid`: an unknown answer to a write is never treated as success.
 *
 * Real contract of the mock (read from `mock-server/src/routes/orders.js`):
 * - 202 `{ status: 'pending', retryAfterSeconds, key }`
 * - 200 `{ status: 'confirmed', order: { id, items, totals... } }`
 */
export function parseOrderResult(payload: unknown): OrderResult | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (payload.status === 'confirmed') {
    return isRecord(payload.order) && isText(payload.order.id)
      ? { status: 'confirmed', orderId: payload.order.id }
      : undefined;
  }

  if (payload.status === 'pending') {
    const seconds = payload.retryAfterSeconds;
    return typeof seconds === 'number' && Number.isInteger(seconds) && seconds >= 1
      ? { status: 'pending', retryAfterSeconds: seconds }
      : undefined;
  }

  return undefined;
}
