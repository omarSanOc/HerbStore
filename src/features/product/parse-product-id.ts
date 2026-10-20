// Matches the catalog ids served by the persistent HerbStore API:
// `product-<6-digit seed token>-<3-digit position>`, e.g. `product-261009-001`.
const PRODUCT_ID_PATTERN = /^product-\d{6}-\d{3}$/;

/**
 * Validates a route param before it reaches the network or the path of a request.
 * Returns the id when it has the catalog shape, `undefined` otherwise (missing, repeated,
 * padded, or with characters that could alter the URL). Existence is the server's concern.
 */
export function parseProductId(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return PRODUCT_ID_PATTERN.test(value) ? value : undefined;
}
