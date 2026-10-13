import type { ApiError } from '../../../core/api/api-error.ts';
import type { OrderResult } from '../contracts/order.ts';
import type { OrderError } from '../contracts/parse-order-error.ts';

export type OrderOutcome = OrderResult['status'] | OrderError['kind'] | 'uncertain';
export function parseOrderOutcome(result: { data?: OrderResult; error?: ApiError }): OrderOutcome {
  if (result.data) return result.data.status;
  if (result.error?.kind !== 'http') return 'uncertain';
  const body = result.error.body;
  return body && typeof body === 'object' && 'kind' in body && typeof body.kind === 'string' ? body.kind as OrderOutcome : 'uncertain';
}

export const classifyOrderOutcome = parseOrderOutcome;
