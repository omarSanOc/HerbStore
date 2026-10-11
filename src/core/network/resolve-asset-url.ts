// Bare origin (scheme + authority, no path, query, credentials or backslashes).
const BARE_ORIGIN = /^https?:\/\/[^\s/?#\\@]+$/i;
// Anything that could be read differently by a URL parser than by this function.
const UNSAFE_CHARACTERS = /[\u0000- \u007f\\]/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns an asset path from the server (`/images/banners/a.png`) into a loadable URL on `origin`.
 *
 * Pure and strict: it only ever returns a URL on the given origin. Protocol-relative URLs
 * (`//host`), other hosts or ports, other schemes (`javascript:`, `data:`, `file:`...) and
 * anything with whitespace, control characters or backslashes give `undefined`, which the image
 * component shows as its labelled fallback. Hand-rolled on purpose: React Native's `URL` does not
 * implement `origin`/`host` consistently across engines.
 */
export function resolveAssetUrl(origin: string, path: string | null | undefined): string | undefined {
  if (typeof path !== 'string' || path === '' || UNSAFE_CHARACTERS.test(path)) {
    return undefined;
  }

  const base = origin.replace(/\/+$/, '');
  if (!BARE_ORIGIN.test(base) || path.startsWith('//')) {
    return undefined;
  }

  if (path.startsWith('/')) {
    return `${base}${path}`;
  }

  if (URL_SCHEME.test(path)) {
    // An absolute URL is acceptable only when it is the same origin (compared case-insensitively),
    // followed by a path: `http://localhost:3001.evil.test/` and `http://localhost:3001@evil.test/`
    // do not continue with `/`, so they fail here.
    const sameOrigin = path.toLowerCase().startsWith(`${base.toLowerCase()}/`);
    return sameOrigin ? path : undefined;
  }

  return `${base}/${path}`;
}
