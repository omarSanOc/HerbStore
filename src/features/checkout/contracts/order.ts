import type { CurrencyCode } from '../../product/contracts/catalog-product.ts';
export type { CurrencyCode } from '../../product/contracts/catalog-product.ts';

/*
 * What the app sends to and keeps from `POST /orders`. Plain types, no RTK, so the pure checkout
 * logic (tags, log lines) is tested on its own.
 */

export type OrderItem = Readonly<{ productId: string; quantity: number }>;

/** The contract of the mock's `shippingAddress` (all strings; `interiorNumber` is optional). */
export type ShippingAddress = Readonly<{
  fullName: string;
  phone: string;
  postalCode: string;
  state: string;
  city: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
}>;

/** The body of `POST /orders`: exactly these three fields (the server rejects any other). */
export type OrderRequest = Readonly<{
  items: readonly OrderItem[];
  currency: CurrencyCode;
  shippingAddress: ShippingAddress;
}>;

/**
 * The only two answers the app keeps from a 2xx. It is a PROJECTION: the server's `pending` also
 * echoes the key and its `confirmed` carries the whole order (items, totals), none of which is
 * stored in the cache.
 *
 * - `pending` (HTTP 202): accepted, not confirmed yet; ask again after `retryAfterSeconds`.
 * - `confirmed` (HTTP 200): the order exists and has this id.
 */
export type OrderResult =
  | Readonly<{ status: 'confirmed'; orderId: string; summary?: OrderSummary }>
  | Readonly<{ status: 'pending'; retryAfterSeconds: number }>;

export type OrderSummary = Readonly<{
  id: string;
  items: readonly Readonly<{ productId: string; quantity: number; unitPrice: number; lineTotal: number }>[];
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  total: number;
  createdAt: string;
}>;
