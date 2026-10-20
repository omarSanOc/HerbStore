/**
 * The one path in the app that carries a secret: `GET /orders/status/:key` puts the full
 * Idempotency-Key in the URL, and the dev logger prints `METHOD path -> outcome` once per attempt.
 *
 * The mask is checkout's `maskIdempotencyKey` rule (`…` + last 4) applied at the boundary that owns
 * the path, so core never imports a feature and no caller can forget it: the last four characters
 * keep "the 202 and the 200 were for the same attempt" observable in the log, and the rest of the
 * key, the address and the body never reach it (RF-38). Every other path is logged untouched — the
 * query string is cut before this runs, because a search term is user input.
 */
export function redactSettledPath(path: string): string {
  const match = /^\/orders\/status\/(.+)$/.exec(path);
  if (!match) return path;
  const key = decodeURIComponent(match[1] ?? '');
  return `/orders/status/${key.length > 4 ? `…${key.slice(-4)}` : '…'}`;
}
