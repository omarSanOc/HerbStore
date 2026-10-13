import { serializeCanonicalOrder } from './canonical-order-request.ts';
import type { OrderRequest } from '../contracts/order.ts';

export type HashFunction = (value: string) => string | Promise<string>;
export async function createFingerprint(request: OrderRequest | string, sha256: HashFunction): Promise<string> {
  return sha256(typeof request === 'string' ? request : serializeCanonicalOrder(request));
}
