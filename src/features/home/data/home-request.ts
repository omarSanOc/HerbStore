import type { SupportedLanguage } from '../../../core/i18n/languages.ts';
import type { HomeData } from '../contracts/home.ts';
import { parseHomePayload } from '../contracts/parse-home.ts';

/**
 * What the `getHome` endpoint asks the base query for: a path, the language of the read and the
 * validator of its payload. `language` is the identity of the request: the base query turns it into
 * `Accept-Language` and requires the matching `Content-Language` (T1), so `getHome('es')` and
 * `getHome('en')` are two cache entries and two requests (RF-22 to RF-24).
 * `parse` returns exactly `HomeData | undefined` (not `unknown`), so the endpoint can state its
 * result type with a single, bounded cast (see `home-api.ts`).
 */
export type HomeRequest = {
  path: string;
  language: SupportedLanguage;
  parse: (payload: unknown) => HomeData | undefined;
};

/**
 * `GET /home`, pure and free of React Native so it is tested on its own. The language comes FIRST
 * because every Home read is localized. The path is a fixed `/home` with no query string: the
 * persistent API is the only source (spec 007, T8). The dev-only runtime fixtures that used to
 * swap this answer (an env-activated fixture switch and a simulated-failure query) were retired
 * with the local backend; see the bundle audit for the anti-regression guard.
 *
 * Timeout (8 s), retries and the error taxonomy are the base query's job, not this file's.
 */
export function buildHomeRequest(language: SupportedLanguage): HomeRequest {
  return {
    path: '/home',
    language,
    parse: parseHomePayload,
  };
}
