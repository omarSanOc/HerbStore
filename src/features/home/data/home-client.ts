import { fetchJson, type FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';
import { parseHomePayload } from '../contracts/parse-home.ts';
import { applyHomeFixture, type HomeFixture } from './home-fixtures.ts';

/** Home gives up after 8 seconds (spec: error with retry, not an endless spinner). */
export const HOME_TIMEOUT_MS = 8_000;

type FetchHomeOptions = {
  origin: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Development fixture, already gated by `resolveHomeFixture`. */
  fixture?: HomeFixture | undefined;
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
};

/**
 * `GET /home`. Returns the raw outcome of `fetchJson` (ok | http | network | invalid | timeout |
 * aborted) with the payload already validated; deciding what each outcome means for the screen
 * is `classifyHomeResult`'s job, so this file stays a thin, replaceable data source (RTK Query
 * takes its place on Day 3).
 */
export function fetchHome({
  origin,
  signal,
  timeoutMs = HOME_TIMEOUT_MS,
  fixture,
  fetchImpl,
}: Readonly<FetchHomeOptions>): Promise<FetchJsonOutcome<HomeData>> {
  const query = fixture === 'server-fail' ? '?fail=true' : '';

  return fetchJson(`${origin}/home${query}`, {
    // The fixture transforms an already valid payload, so real failures are never hidden by it.
    parse: (payload) => {
      const data = parseHomePayload(payload);
      return data !== undefined && fixture !== undefined ? applyHomeFixture(fixture, data) : data;
    },
    signal,
    timeoutMs,
    fetchImpl,
  });
}
