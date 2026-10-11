// Pure module: no React Native, no `@/` alias, relative imports with extension,
// so `npm run test:logic` can run it on plain Node.
import { parseProductId } from '../../features/product/parse-product-id.ts';

const APP_SCHEME = 'herbstore';
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):(.*)$/i;

/**
 * Path used for a product link whose id is missing or malformed. The route then renders the
 * "not found" state of the product screen, and the untrusted input never becomes a route param.
 */
const INVALID_PRODUCT_SEGMENT = 'invalid';

/**
 * Turns an incoming URL into the in-app path that Expo Router should open.
 *
 * - `herbstore://product/<id>` (also `herbstore:///product/<id>`) -> `/product/<id>`; query,
 *   fragment and trailing slash are dropped; an id that is not catalog-shaped becomes
 *   `/product/invalid`.
 * - The root (`herbstore:///`, which is what a normal launch reports) -> `/`.
 * - Any other host of the app scheme passes through as a path; if no route matches, the router
 *   shows `+not-found`.
 * - A different scheme (https, the dev client launcher `exp+herbstore://...`) or empty/non-string
 *   input -> `null`, which means "leave navigation alone".
 *
 * Never throws: an exception inside `redirectSystemPath` can close the app.
 */
export function normalizeIncomingUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (trimmed === '') {
    return null;
  }

  // Query string and fragment never take part in routing.
  const withoutSuffix = trimmed.split(/[?#]/, 1)[0] ?? '';

  let rest = withoutSuffix;
  const schemeMatch = SCHEME_PATTERN.exec(withoutSuffix);
  if (schemeMatch) {
    if (schemeMatch[1]?.toLowerCase() !== APP_SCHEME) {
      return null;
    }
    rest = schemeMatch[2] ?? '';
  } else if (!withoutSuffix.startsWith('/')) {
    return null;
  }

  // `herbstore://product/x` and `herbstore:///product/x` are the same destination.
  const segments = rest.split('/').filter((segment) => segment !== '');
  const host = segments[0]?.toLowerCase();
  if (host === undefined) {
    return '/';
  }

  if (host === 'product' && segments.length <= 2) {
    return `/product/${parseProductId(segments[1]) ?? INVALID_PRODUCT_SEGMENT}`;
  }

  return `/${[host, ...segments.slice(1)].join('/')}`;
}

/**
 * Expo Router `+native-intent` hook. It receives the full URL (a normal launch reports the root
 * URL, not `null`) and returns the path to open, or `null` to ignore the link.
 */
export function redirectSystemPath(event: { path: string; initial: boolean }): string | null {
  try {
    return normalizeIncomingUrl(event?.path);
  } catch {
    return null;
  }
}
