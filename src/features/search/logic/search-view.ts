// What the search screen shows for the text in the field (pure logic).
//
// Two texts matter: `rawText`, what the field holds right now, and `debouncedText`, the value that
// settled 400 ms after the last change (`useDebouncedValue`). The rule compares their NORMALIZED
// forms, because that is the identity of a search (spec 003, Definitions): adding a trailing space
// or changing a capital letter is not a new search and must not make the screen wait again.

import { normalizeSearchText } from '../../product/logic/product-query.ts';

/** RF-16: the search starts 400 ms after the last change. The only place this number lives. */
export const SEARCH_DEBOUNCE_MS = 400;

export type SearchView =
  /** Empty (or only spaces) field: the history, no query. */
  | { kind: 'history' }
  /** The user typed something that has not settled yet: wait, do not query, show no results. */
  | { kind: 'pending' }
  /** The text settled: query the catalog with this normalized `q`. */
  | { kind: 'query'; q: string };

/**
 * - `rawText` empty after normalizing -> `history`, even if `debouncedText` still holds the text the
 *   user just erased: clearing the field must show the history at once and never query again.
 * - `rawText` not empty and its normalized form differs from the debounced one -> `pending`. That
 *   includes a debounced text that is still empty (the first keystrokes). While pending, the
 *   screen must NOT show results: any it had belong to an older text.
 * - Equal normalized forms -> `query` with that form as `q`.
 *
 * It never returns `query` with an empty `q`: the server answers 400 to an empty `q`.
 */
export function resolveSearchView({
  rawText,
  debouncedText,
}: Readonly<{ rawText: string; debouncedText: string }>): SearchView {
  const raw = normalizeSearchText(rawText);
  if (raw === '') {
    return { kind: 'history' };
  }

  if (raw !== normalizeSearchText(debouncedText)) {
    return { kind: 'pending' };
  }

  return { kind: 'query', q: raw };
}

/**
 * The text to send when the keyboard's search key is pressed (S-2).
 *
 * The submit event carries the text the field holds NATIVELY at that instant. The `text` of a React
 * render can be a few keys behind: on a slow JS thread (a development build on a low-end phone) the
 * key can arrive less than 0.3 s after the last character, before React rendered it, and a handler
 * that reads the state would send "t" for "tablets" and write that fragment in the history (RF-17).
 * An empty string is a real value (the field was emptied); only a missing one falls back.
 */
export function resolveSubmittedText(eventText: string | undefined, fieldText: string): string {
  return typeof eventText === 'string' ? eventText : fieldText;
}
