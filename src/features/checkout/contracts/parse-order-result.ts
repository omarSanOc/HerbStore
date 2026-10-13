import { isRecord, isText } from '../../../core/validation/json-guards.ts';
import type { CurrencyCode, OrderResult, OrderSummary } from './order.ts';

function money(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function summary(value: unknown): OrderSummary | undefined {
  if (!isRecord(value) || !isText(value.id) || !isText(value.createdAt) ||
      (value.currency !== 'MXN' && value.currency !== 'USD') ||
      !money(value.subtotal) || !money(value.shipping) || !money(value.total) || !Array.isArray(value.items)) return undefined;
  const items = value.items.map((item) => {
    if (!isRecord(item) || !isText(item.productId) || typeof item.quantity !== 'number' || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        !money(item.unitPrice) || !money(item.lineTotal)) return undefined;
    return { productId: item.productId, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal };
  });
  return items.every(Boolean) ? { id: value.id, items: items as OrderSummary['items'], currency: value.currency as CurrencyCode, subtotal: value.subtotal, shipping: value.shipping, total: value.total, createdAt: value.createdAt } : undefined;
}

export function parseOrderResult(payload: unknown, status?: number): OrderResult | undefined {
  if (!isRecord(payload)) return undefined;
  if (payload.status === 'confirmed') {
    const order = summary(payload.order);
    return (status ?? 200) === 200 && order ? { status: 'confirmed', orderId: order.id, summary: order } : undefined;
  }
  if (payload.status === 'pending') {
    const seconds = payload.retryAfterSeconds;
    return (status ?? 202) === 202 && typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds >= 1
      ? { status: 'pending', retryAfterSeconds: seconds } : undefined;
  }
  return undefined;
}
