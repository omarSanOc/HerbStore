import type { CurrencyCode, OrderItem, OrderRequest, ShippingAddress } from '../contracts/order.ts';

export function buildCheckoutRequest(items: readonly OrderItem[], currency: CurrencyCode, shippingAddress: ShippingAddress): OrderRequest {
  return { items: items.map((item) => ({ ...item })), currency, shippingAddress: { ...shippingAddress } };
}
