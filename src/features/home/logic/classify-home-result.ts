import type { FetchJsonOutcome } from '../../../core/network/http.ts';
import type { HomeData } from '../contracts/home.ts';

/** Notice shown above data that is kept after a failed refresh. */
export type HomeNotice = 'offline' | 'update-failed';

/**
 * What the screen renders. A discriminated union: each variant carries exactly the data it needs,
 * so the screen `switch`es on `status` and the compiler checks every case.
 */
export type HomeScreenState =
  | { status: 'loading' }
  | { status: 'ready'; data: HomeData; notice?: HomeNotice }
  | { status: 'empty' }
  | { status: 'offline' }
  | { status: 'error' };

/** Removes only the empty collections: banners, categories and each section without items. */
function withoutEmptyCollections(data: HomeData): HomeData {
  return {
    banners: data.banners,
    categories: data.categories,
    sections: data.sections.filter(({ items }) => items.length > 0),
  };
}

function hasContent({ banners, categories, sections }: HomeData): boolean {
  return banners.length > 0 || categories.length > 0 || sections.length > 0;
}

/**
 * Pure rule that turns "what we had" and "how the last request ended" into a screen state.
 *
 * - `outcome` undefined (or `aborted`) means the request is still pending: loading, or the
 *   previous data without a notice while refreshing.
 * - Success replaces the previous data; empty collections are omitted one by one and only when
 *   everything is empty does the screen show `empty`.
 * - Failure with usable previous data keeps it plus a notice (`offline` when `fetch` failed without
 *   a response, i.e. outcome `network`, otherwise `update-failed`); without usable data it is the
 *   offline screen or the error screen. HTTP errors (5xx), timeouts and invalid payloads are `error`, never `offline`.
 */
export function classifyHomeResult(
  previous: HomeData | undefined,
  outcome: FetchJsonOutcome<HomeData> | undefined,
): HomeScreenState {
  const visiblePrevious = previous === undefined ? undefined : withoutEmptyCollections(previous);
  const usablePrevious =
    visiblePrevious !== undefined && hasContent(visiblePrevious) ? visiblePrevious : undefined;

  if (outcome === undefined || outcome.kind === 'aborted') {
    return usablePrevious === undefined
      ? { status: 'loading' }
      : { status: 'ready', data: usablePrevious };
  }

  if (outcome.kind === 'ok') {
    const data = withoutEmptyCollections(outcome.data);
    return hasContent(data) ? { status: 'ready', data } : { status: 'empty' };
  }

  if (usablePrevious !== undefined) {
    return {
      status: 'ready',
      data: usablePrevious,
      notice: outcome.kind === 'network' ? 'offline' : 'update-failed',
    };
  }

  return outcome.kind === 'network' ? { status: 'offline' } : { status: 'error' };
}
