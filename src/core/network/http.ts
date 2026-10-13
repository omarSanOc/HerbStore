export const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Discriminated result of a request. Nothing here throws, so callers `switch` on `kind`.
 *
 * - `network`: `fetch` rejected without any response (server down, no route, offline), whatever the
 *   error class is, unless the rejection came from our own timeout or cancellation.
 * - `http`: the server answered with a non-2xx status.
 * - `invalid`: 2xx but the body is not JSON or does not pass `parse`.
 * - `timeout`: no complete answer within `timeoutMs`.
 * - `aborted`: the caller cancelled through its own `signal` (unmount, new request).
 */
export type FetchJsonOutcome<T> =
  | { kind: 'ok'; data: T; status: number }
  | { kind: 'http'; status: number }
  | { kind: 'network' }
  | { kind: 'invalid' }
  | { kind: 'timeout' }
  | { kind: 'aborted' };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type FetchJsonOptions<T> = {
  /** Defaults to `GET`. */
  method?: HttpMethod;
  /** Any JSON-serializable value; when present it is sent as the JSON body with `Content-Type`. */
  body?: unknown;
  /** Extra request headers (e.g. `Idempotency-Key`); they are added on top of `Accept`. */
  headers?: Readonly<Record<string, string>>;
  /** Validates the decoded JSON; return `undefined` when it does not have the expected shape. */
  parse: (payload: unknown) => T | undefined;
  /** Caller cancellation. */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injection point for tests; defaults to the global `fetch`. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
};

export async function fetchJson<T>(
  url: string,
  {
    method = 'GET',
    body,
    headers,
    parse,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImpl = fetch,
  }: FetchJsonOptions<T>,
): Promise<FetchJsonOutcome<T>> {
  const callerAborted = () => signal?.aborted === true;

  if (callerAborted()) {
    return { kind: 'aborted' };
  }

  // One controller per request: it is aborted by the timer or by the caller's signal.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  // Our own cancellations win over every other classification, whatever error type the runtime
  // rejects with (expo/fetch throws a `FetchError`, Hermes' polyfill a `TypeError`, undici an `AbortError`).
  const cancelled = (): FetchJsonOutcome<T> | undefined =>
    timedOut ? { kind: 'timeout' } : callerAborted() ? { kind: 'aborted' } : undefined;

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          Accept: 'application/json',
          // Only a request that carries a body declares its content type.
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
    } catch {
      // `fetch` rejected before any response: DNS, refused connection, no route, offline. Classified
      // by structure ("no response"), not by `instanceof`: expo/fetch rejects with `FetchError extends Error`.
      return cancelled() ?? { kind: 'network' };
    }

    if (!response.ok) {
      return { kind: 'http', status: response.status };
    }

    try {
      const data = parse(await response.json());
      return data === undefined
        ? { kind: 'invalid' }
        : { kind: 'ok', data, status: response.status };
    } catch {
      // A response arrived but its body is unreadable or not JSON: the answer cannot be used.
      return cancelled() ?? { kind: 'invalid' };
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
