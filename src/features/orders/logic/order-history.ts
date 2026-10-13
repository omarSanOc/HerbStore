import type { OrderSummary } from '../../checkout/contracts/order.ts';
export type OrderHistoryState = Readonly<{ orders: readonly OrderSummary[] }>;
export const emptyOrderHistory: OrderHistoryState = { orders: [] };
export function sanitizeOrderSummary(summary: OrderSummary): OrderSummary {
  return { id: summary.id, items: summary.items.map(({ productId, quantity, unitPrice, lineTotal }) => ({ productId, quantity, unitPrice, lineTotal })), currency: summary.currency, subtotal: summary.subtotal, shipping: summary.shipping, total: summary.total, createdAt: summary.createdAt };
}
export function addOrderSummary(state: OrderHistoryState, summary: OrderSummary): { state: OrderHistoryState; added: boolean } {
  if (state.orders.some((order) => order.id === summary.id)) return { state, added: false };
  return { state: { orders: [...state.orders, sanitizeOrderSummary(summary)] }, added: true };
}
