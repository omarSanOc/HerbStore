import { isRecord, isText } from '../../../core/validation/json-guards.ts';

export type OrderError = Readonly<{ kind: 'validation'; fields: Readonly<Record<string, string>> } | { kind: 'outOfStock' } | { kind: 'keyReused'; statusPath: string } | { kind: 'notCreated' } | { kind: 'expired' } | { kind: 'inconsistent' }>;

export function parseOrderError(status: number, payload: unknown, currentKey: string): OrderError {
  if (!isRecord(payload) || !isRecord(payload.error) || !isText(payload.error.code)) return { kind: 'inconsistent' };
  const code = payload.error.code;
  if (status === 400 && code === 'VALIDATION_ERROR' && isRecord(payload.fields)) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload.fields)) if (isText(value)) fields[key] = value;
    return { kind: 'validation', fields };
  }
  if (status === 409 && code === 'OUT_OF_STOCK' && Object.keys(payload).every((key) => key === 'error')) return { kind: 'outOfStock' };
  if (status === 409 && code === 'IDEMPOTENCY_KEY_REUSED' && isRecord(payload.links) && isText(payload.links.status)) {
    const expected = `/orders/status/${encodeURIComponent(currentKey)}`;
    return payload.links.status === expected ? { kind: 'keyReused', statusPath: expected } : { kind: 'inconsistent' };
  }
  if (status === 404 && payload.status === 'not_created' && code === 'ORDER_NOT_CREATED') return { kind: 'notCreated' };
  if (status === 410 && payload.status === 'expired' && code === 'IDEMPOTENCY_KEY_EXPIRED') return { kind: 'expired' };
  return { kind: 'inconsistent' };
}

export function parseApiOrderError(status: number, payload: unknown, key: string): OrderError {
  return parseOrderError(status, payload, key);
}
