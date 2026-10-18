// A controlled `fetch` for tests: no network, no real clock, no MSW.
//
// Each request is matched to a QUEUE of replies (`enqueue`, consumed in order) or to a permanent
// one (`always`). A reply says what the server does: answer (success, empty, 4xx, 5xx, optionally
// after a delay), refuse the connection or never answer. Delays and timeouts use `setTimeout`, so a
// test with `jest.useFakeTimers()` decides when time passes (`jest.advanceTimersByTimeAsync`).
//
// Compose/Android: a `MockWebServer` with `enqueue(MockResponse())`. Swift: a `URLProtocol` stub.

type Behavior =
  | Readonly<{ kind: 'respond'; status: number; body: unknown }>
  | Readonly<{ kind: 'network-error' }>
  | Readonly<{ kind: 'hang' }>;

export type MockReply = Readonly<{ behavior: Behavior; delayMs: number }>;

type ReplyOptions = Readonly<{ delayMs?: number }>;
type SuccessOptions = ReplyOptions & Readonly<{ status?: number }>;

const respond = (status: number, body: unknown, { delayMs = 0 }: ReplyOptions = {}): MockReply => ({
  behavior: { kind: 'respond', status, body },
  delayMs,
});

/** Builders for what the server does. The body of an error is optional JSON. */
export const reply = {
  /** 2xx with a JSON body (200 unless `status` says otherwise). */
  success: (body: unknown, { status = 200, delayMs }: SuccessOptions = {}) => respond(status, body, { delayMs }),
  /** 200 with an empty catalog page (`GET /products` shape); pass `body` for another endpoint. */
  empty: (body: unknown = { items: [], page: 1, totalPages: 0, total: 0 }, options: ReplyOptions = {}) =>
    respond(200, body, options),
  clientError: (status = 400, body: unknown = { error: 'client error' }, options: ReplyOptions = {}) =>
    respond(status, body, options),
  serverError: (status = 500, body: unknown = { error: 'server error' }, options: ReplyOptions = {}) =>
    respond(status, body, options),
  /** `fetch` rejects without a response: server down, no route, offline. */
  networkError: ({ delayMs = 0 }: ReplyOptions = {}): MockReply => ({ behavior: { kind: 'network-error' }, delayMs }),
  /** The server never answers: only the caller's timeout or abort ends the request. */
  timeout: (): MockReply => ({ behavior: { kind: 'hang' }, delayMs: 0 }),
};

export type RecordedCall = Readonly<{
  method: string;
  /** Path without origin or query string, e.g. `/products`. */
  path: string;
  url: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
}>;

type Matcher = string | RegExp;

type Route = { matcher: Matcher; queue: MockReply[]; permanent?: MockReply };

function describeRequest(method: string, path: string) {
  return `${method} ${path}`;
}

/** `'GET /products'` matches method AND path; `'/products'` only the path; a RegExp tests `METHOD path`. */
function matches(matcher: Matcher, method: string, path: string): boolean {
  if (matcher instanceof RegExp) return matcher.test(describeRequest(method, path));
  const [first, second] = matcher.split(' ');
  return second === undefined ? first === path : first === method && second === path;
}

function abortError(): Error {
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function headersOf(init: RequestInit | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function bodyOf(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== 'string') return undefined;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

/** A fake response with only what the app reads (`ok`, `status`, `json()`), typed as `Response`. */
function toResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(JSON.parse(JSON.stringify(body))),
  } as Response;
}

export function createMockFetch() {
  const routes: Route[] = [];
  const calls: RecordedCall[] = [];
  const unmatched: string[] = [];
  let original: typeof globalThis.fetch | undefined;

  function routeFor(matcher: Matcher): Route {
    const existing = routes.find((route) => String(route.matcher) === String(matcher));
    if (existing !== undefined) return existing;
    const route: Route = { matcher, queue: [] };
    routes.push(route);
    return route;
  }

  const mockFetch = (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = new URL(url).pathname;
    calls.push({ method, path, url, headers: headersOf(init), body: bodyOf(init) });

    const route = routes.find((candidate) => matches(candidate.matcher, method, path) && (candidate.queue.length > 0 || candidate.permanent !== undefined));
    const next = route === undefined ? undefined : (route.queue.shift() ?? route.permanent);
    if (next === undefined) {
      unmatched.push(describeRequest(method, path));
      return Promise.reject(new TypeError(`mock-fetch: no reply queued for ${describeRequest(method, path)}`));
    }

    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => {
        if (timer !== undefined) clearTimeout(timer);
        reject(abortError());
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });

      const settle = () => {
        signal?.removeEventListener('abort', onAbort);
        const { behavior } = next;
        if (behavior.kind === 'network-error') reject(new TypeError('Network request failed'));
        else if (behavior.kind === 'respond') resolve(toResponse(behavior.status, behavior.body));
        // 'hang': stays pending until the abort listener above rejects it.
      };

      if (next.behavior.kind === 'hang') {
        // Nothing to schedule: the request ends only when the caller aborts.
      } else if (next.delayMs > 0) {
        timer = setTimeout(settle, next.delayMs);
      } else {
        settle();
      }
    });
  };

  return {
    fetch: mockFetch as typeof fetch,
    /** Every request received, in order, including the unmatched ones. */
    calls: calls as readonly RecordedCall[],
    /** `METHOD path` of the requests that had no reply queued (they reject like a network error). */
    unmatched: unmatched as readonly string[],
    /** Queues replies for a route; each request consumes one, in order. */
    enqueue(matcher: Matcher, ...replies: MockReply[]) {
      routeFor(matcher).queue.push(...replies);
    },
    /** A permanent reply for a route, used when its queue is empty. */
    always(matcher: Matcher, permanent: MockReply) {
      routeFor(matcher).permanent = permanent;
    },
    /** Replies still queued for a route (permanent ones are not counted). */
    remaining(matcher: Matcher): number {
      return routes.find((route) => String(route.matcher) === String(matcher))?.queue.length ?? 0;
    },
    /** Replaces `globalThis.fetch`; the app's default `fetchImpl` reads the global at call time. */
    install() {
      original = globalThis.fetch;
      globalThis.fetch = mockFetch as typeof fetch;
    },
    uninstall() {
      if (original !== undefined) globalThis.fetch = original;
      original = undefined;
    },
  };
}
