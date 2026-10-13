import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
import type { OrderRequest, OrderResult, ShippingAddress } from '../contracts/order.ts';

/*
 * Pieces of the DEV-ONLY "create test order" control (`OrderDevControls`, removed on Day 4 when the
 * real product detail and checkout arrive, H-4). Nothing here is a real checkout.
 */

/** After a 202 the same POST is repeated at most this many times (plan: "hasta 3 veces"). */
export const MAX_DEV_REPOSTS = 3;

/** The longest wait the control accepts from the server's `retryAfterSeconds`. */
const MAX_DEV_DELAY_MS = 5_000;

/**
 * Fictitious address, obviously fake and shared by every dev order. It satisfies the mock's
 * validation (read from `mock-server/src/orders/order-contract.js`): 10-digit phone, 5-digit postal
 * code and the minimum lengths. It never comes from the user, is never logged and never persisted.
 */
export const DEV_SHIPPING_ADDRESS: ShippingAddress = Object.freeze({
  fullName: 'Test Customer',
  phone: '0000000000',
  postalCode: '00000',
  state: 'Test State',
  city: 'Test City',
  street: 'Test Street',
  exteriorNumber: '0',
});

/**
 * One idempotency key per ATTEMPT: created when the button is pressed and reused by every re-POST of
 * that attempt, so the server recognizes them as the same order. Receives `now` and `random` instead
 * of reading them so it is deterministic in tests.
 *
 * Unique enough for development, NOT cryptographic: the real checkout (Day 4) will use a UUID.
 * Format `dev-<time base36>-<8 random base36 chars>`; no spaces, the server trims the header.
 */
export function createDevIdempotencyKey(now: number, random: number): string {
  const safeRandom = Number.isFinite(random) && random >= 0 && random < 1 ? random : 0;
  const suffix = Math.floor(safeRandom * 36 ** 8)
    .toString(36)
    .padStart(8, '0');

  return `dev-${Math.floor(now).toString(36)}-${suffix}`;
}

/** The body of the dev order: one unit of one product, in the product's currency. */
export function buildDevOrderRequest(productId: string, currency: CurrencyCode): OrderRequest {
  return {
    items: [{ productId, quantity: 1 }],
    currency,
    shippingAddress: DEV_SHIPPING_ADDRESS,
  };
}

/** `retryAfterSeconds` in ms, capped so a misbehaving server cannot park the control for long. */
export function devRetryDelayMs(retryAfterSeconds: number): number {
  return Math.min(Math.max(retryAfterSeconds, 0) * 1_000, MAX_DEV_DELAY_MS);
}

export type DevOrderStep =
  | { kind: 'done' }
  | { kind: 'repost'; delayMs: number }
  | { kind: 'give-up' };

/**
 * What to do after an ANSWER (a failure ends the attempt before reaching this): `confirmed` ends it;
 * `pending` repeats the same request (same key, same body) after the delay, up to `MAX_DEV_REPOSTS`
 * times. This is the 202 protocol, NOT an automatic retry of a failure (P2: those are zero).
 */
export function nextDevOrderStep(result: OrderResult, repostsDone: number): DevOrderStep {
  if (result.status === 'confirmed') {
    return { kind: 'done' };
  }

  return repostsDone < MAX_DEV_REPOSTS
    ? { kind: 'repost', delayMs: devRetryDelayMs(result.retryAfterSeconds) }
    : { kind: 'give-up' };
}
