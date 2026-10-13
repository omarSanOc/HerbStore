import type { HomeData } from '../contracts/home.ts';
import { parseHomePayload } from '../contracts/parse-home.ts';
import { applyHomeFixture, type HomeFixture } from './home-fixtures.ts';

/**
 * What the `getHome` endpoint asks the base query for: a path and the validator of its payload.
 * `parse` returns exactly `HomeData | undefined` (not `unknown`), so the endpoint can state its
 * result type with a single, bounded cast (see `home-api.ts`).
 */
export type HomeRequest = {
  path: string;
  parse: (payload: unknown) => HomeData | undefined;
};

/**
 * `GET /home`, pure and free of React Native so it is tested on its own. The development fixture
 * (already gated by `resolveHomeFixture`) is applied here:
 *
 * - `server-fail` asks the real server for its simulated 500 (`?fail=true`).
 * - the data fixtures transform an already valid payload, so a real failure is never hidden.
 *
 * Timeout (8 s), retries and the error taxonomy are the base query's job, not this file's.
 */
export function buildHomeRequest(fixture: HomeFixture | undefined): HomeRequest {
  return {
    path: fixture === 'server-fail' ? '/home?fail=true' : '/home',
    parse: (payload) => {
      const data = parseHomePayload(payload);
      return data !== undefined && fixture !== undefined ? applyHomeFixture(fixture, data) : data;
    },
  };
}
