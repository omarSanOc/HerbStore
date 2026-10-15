import type { OrderSummary } from '../../checkout/contracts/order.ts';
import { emptyOrderNotificationState, type OrderNotificationState, sanitizeOrderNotificationState } from './order-notification-state.ts';
export type OrderHistoryState = Readonly<{ orders: readonly OrderSummary[]; notifications: OrderNotificationState }>;
export const emptyOrderHistory: OrderHistoryState = { orders: [], notifications: emptyOrderNotificationState };
export function sanitizeOrderSummary(summary: OrderSummary): OrderSummary {
  return { id: summary.id, items: summary.items.map(({ productId, quantity, unitPrice, lineTotal }) => ({ productId, quantity, unitPrice, lineTotal })), currency: summary.currency, subtotal: summary.subtotal, shipping: summary.shipping, total: summary.total, createdAt: summary.createdAt };
}
export function addOrderSummary(state: OrderHistoryState, summary: OrderSummary): { state: OrderHistoryState; added: boolean } {
  if (state.orders.some((order) => order.id === summary.id)) return { state, added: false };
  return { state: { ...state, orders: [...state.orders, sanitizeOrderSummary(summary)] }, added: true };
}

export function sanitizeOrderHistory(stored: unknown): OrderHistoryState {
  const source = stored && typeof stored === 'object' ? stored as { orders?: unknown; notifications?: unknown } : {};
  const orders = Array.isArray(source.orders)
    ? source.orders.flatMap((value): OrderSummary[] => {
      if (!value || typeof value !== 'object') return [];
      const candidate = value as Partial<OrderSummary>;
      if (typeof candidate.id !== 'string' || !Array.isArray(candidate.items) || (candidate.currency !== 'MXN' && candidate.currency !== 'USD') || ![candidate.subtotal, candidate.shipping, candidate.total].every((item) => typeof item === 'number' && Number.isFinite(item))) return [];
      try { return [sanitizeOrderSummary(candidate as OrderSummary)]; } catch { return []; }
    })
    : [];
  const unique = orders.filter((order, index) => orders.findIndex((candidate) => candidate.id === order.id) === index);
  return { orders: unique, notifications: sanitizeOrderNotificationState(source.notifications, unique.map(({ id }) => id)) };
}
