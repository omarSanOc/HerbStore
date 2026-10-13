import type { OrderRequest, ShippingAddress } from '../contracts/order.ts';

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value as object).sort().map((key) => [key, sorted((value as Record<string, unknown>)[key])]));
  return value;
}
function trimAddress(address: ShippingAddress): ShippingAddress {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(address)) {
    const text = value.trim();
    if (key !== 'interiorNumber' || text) result[key] = text;
  }
  return result as ShippingAddress;
}
export function canonicalizeOrderRequest(request: OrderRequest): OrderRequest {
  const seen = new Set<string>();
  const items = request.items.map((item) => {
    const productId = item.productId.trim();
    if (seen.has(productId)) throw new Error(`Duplicate product: ${productId}`);
    seen.add(productId);
    return { productId, quantity: item.quantity };
  }).sort((left, right) => left.productId.localeCompare(right.productId, 'en'));
  return { items, currency: request.currency.trim() as OrderRequest['currency'], shippingAddress: trimAddress(request.shippingAddress) };
}
export function serializeCanonicalOrder(request: OrderRequest): string {
  return JSON.stringify(sorted(canonicalizeOrderRequest(request)));
}
