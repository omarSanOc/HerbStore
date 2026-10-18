import type { ApiError } from '../../../core/api/api-error.ts';
import type { OrderResult } from '../contracts/order.ts';
import type { OrderError } from '../contracts/parse-order-error.ts';
import { isRecord } from '../../../core/validation/json-guards.ts';

export type OrderOutcome = OrderResult['status'] | OrderError['kind'] | 'uncertain';
export function parseOrderOutcome(result: { data?: OrderResult; error?: ApiError }): OrderOutcome {
  if (result.data) return result.data.status;
  if (result.error?.kind !== 'http') return 'uncertain';
  const body = result.error.body;
  return body && typeof body === 'object' && 'kind' in body && typeof body.kind === 'string' ? body.kind as OrderOutcome : 'uncertain';
}

export const classifyOrderOutcome = parseOrderOutcome;

/**
 * The server paths of a 400 validation error (`{ 'shippingAddress.phone': 'INVALID_FORMAT' }`), or
 * `undefined` for any other failure. Nothing else of the body leaves this function.
 */
export function validationFieldsOf(error: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(error) || error.kind !== 'http' || !isRecord(error.body)) return undefined;
  const { body } = error;
  return body.kind === 'validation' && isRecord(body.fields) ? (body.fields as Readonly<Record<string, string>>) : undefined;
}
