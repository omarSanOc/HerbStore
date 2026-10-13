import { useEffect, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '../logic/search-view';

/**
 * `value` delayed until it has been still for `SEARCH_DEBOUNCE_MS` (400 ms, RF-16), plus `flush`,
 * which publishes a value at once (the user sent the search, so waiting makes no sense).
 *
 * How it works: every change of `value` re-runs the effect, whose CLEANUP cancels the previous
 * timer before the new one starts. So at most one `setTimeout` exists, and it always carries the
 * latest text; when the component unmounts the cleanup cancels it too (no leak, no `setState` on
 * a dead screen). The timer callback closes over the `value` of the render that created it, which
 * is exactly what is wanted here: a newer render would have cancelled it.
 *
 * It does NOT cancel requests: a slow response to an old text is not this hook's business. The
 * screen compares the field with the settled text (`resolveSearchView`) and RTK Query keeps one
 * entry per text, read through `currentData`.
 *
 * Compose: `snapshotFlow { text }.debounce(400).distinctUntilChanged()` (+ `collectLatest` /
 * `flatMapLatest` for the request); SwiftUI: Combine `.debounce(for: .milliseconds(400))` +
 * `.removeDuplicates()` (+ `switchToLatest`), or `.task(id: text)` that sleeps 400 ms (the task is
 * cancelled when the id changes).
 */
export function useDebouncedValue(
  value: string,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): readonly [debounced: string, flush: (next: string) => void] {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // Already settled (first render, or `flush` published this very value): nothing to wait for.
    // Re-running because `debounced` changed also cancels a timer that `flush` made redundant.
    if (value === debounced) {
      return;
    }

    const timer = setTimeout(() => {
      if (__DEV__) {
        console.log(`[search] debounced after ${delayMs}ms`);
      }
      setDebounced(value);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [value, debounced, delayMs]);

  const flush = (next: string) => {
    if (__DEV__ && next !== '') {
      console.log('[search] sent (no wait)');
    }
    setDebounced(next);
  };

  return [debounced, flush];
}
