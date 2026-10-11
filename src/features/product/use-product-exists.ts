import { useEffect, useState } from 'react';

import { apiOrigin } from '@/core/network/api-origin';

import { fetchProductLookup, type ProductLookup, type ProductSummary } from './product-client';

export type ProductExistsState =
  | { status: 'loading' }
  | { status: 'found'; product: ProductSummary }
  | { status: 'not-found' }
  | { status: 'offline' }
  | { status: 'error' };

type SettledLookup = {
  id: string;
  attempt: number;
  lookup: Exclude<ProductLookup, { status: 'aborted' }>;
};

/**
 * Checks that a product exists on the server.
 * `id` must come from `parseProductId`; `undefined` (missing or invalid) resolves to
 * `not-found` without any request.
 */
export function useProductExists(
  id: string | undefined,
): ProductExistsState & { retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<SettledLookup | null>(null);

  useEffect(() => {
    if (id === undefined) {
      return;
    }

    const controller = new AbortController();

    void fetchProductLookup({ origin: apiOrigin, id, signal: controller.signal }).then(
      (lookup) => {
        // The cleanup below aborts a stale request, but its answer may already be in flight:
        // drop it instead of overwriting the state of a newer id or attempt.
        if (controller.signal.aborted || lookup.status === 'aborted') {
          return;
        }
        setSettled({ id, attempt, lookup });
      },
    );

    return () => controller.abort();
  }, [id, attempt]);

  const retry = () => setAttempt((current) => current + 1);

  // Derived during render: an answer only counts for the id and attempt it was requested for,
  // so changing either returns to `loading` without a synchronous setState inside the effect.
  if (id === undefined) {
    return { status: 'not-found', retry };
  }
  if (settled === null || settled.id !== id || settled.attempt !== attempt) {
    return { status: 'loading', retry };
  }
  return { ...settled.lookup, retry };
}
