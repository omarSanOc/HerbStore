import { fetchJson } from '../../core/network/http.ts';

export type ProductSummary = {
  id: string;
  name: string;
};

/** What the Product route needs to know. The full detail contract arrives on Day 4. */
export type ProductLookup =
  | { status: 'found'; product: ProductSummary }
  | { status: 'not-found' }
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'aborted' };

type FetchProductLookupOptions = {
  origin: string;
  /** Already validated with `parseProductId`. */
  id: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
};

function parseProductSummary(payload: unknown): ProductSummary | undefined {
  if (typeof payload !== 'object' || payload === null) {
    return undefined;
  }

  const { id, name } = payload as Record<string, unknown>;

  return typeof id === 'string' && id !== '' && typeof name === 'string' && name !== ''
    ? { id, name }
    : undefined;
}

/**
 * `GET /products/:id`. Offline (no response) and error (server answered badly, timeout) stay
 * distinct so the screen can say something different for each.
 */
export async function fetchProductLookup({
  origin,
  id,
  signal,
  timeoutMs,
  fetchImpl,
}: Readonly<FetchProductLookupOptions>): Promise<ProductLookup> {
  const outcome = await fetchJson(`${origin}/products/${encodeURIComponent(id)}`, {
    parse: parseProductSummary,
    signal,
    timeoutMs,
    fetchImpl,
  });

  switch (outcome.kind) {
    case 'ok':
      return { status: 'found', product: outcome.data };
    case 'http':
      return outcome.status === 404 ? { status: 'not-found' } : { status: 'error' };
    case 'network':
      return { status: 'offline' };
    case 'aborted':
      return { status: 'aborted' };
    case 'invalid':
    case 'timeout':
      return { status: 'error' };
  }
}
