// Search history (pure logic: no React Native, no RTK values).
//
// The history is the list of searches the user sent, newest first, at most 10 (spec 003, RF-17,
// RF-18). Its identity rule is the NORMALIZED form of the text (`normalizeSearchText`: trim, one
// space between words, lowercase, no diacritics), the same definition the API search and the
// query identity use, so "Vitamina C" and "vitamina  c" are one entry. The entry keeps the HUMAN
// text of the most recent variant: the normalized form is only the key, never what is shown.
//
// Every function returns a new array, or the very same one when nothing changes (so Redux and
// React see "no change" by reference). None mutates its input.

import { normalizeSearchText } from '../../product/logic/product-query.ts';

/** Visible texts, most recent first. The identity of each is `normalizeSearchText(text)`. */
export type SearchHistory = readonly string[];

/** Spec 003, Definitions: "up to 10 searches". */
export const MAX_SEARCH_HISTORY = 10;

export const EMPTY_SEARCH_HISTORY: SearchHistory = [];

/**
 * Records a search that was SENT (return key, a history entry or a tapped result).
 *
 * - An empty normalized form (empty text, only spaces, a lone combining mark) is never stored.
 * - The text is kept as typed, only trimmed: the outer spaces belong to no variant.
 * - If the identity is already there, that entry is replaced by this latest variant and moved to
 *   the front, so there is never a duplicate.
 * - Above `MAX_SEARCH_HISTORY` the OLDEST entries (the tail) fall off.
 */
export function addSearch(history: SearchHistory, text: string): SearchHistory {
  const key = normalizeSearchText(text);
  if (key === '') {
    return history;
  }

  const visible = text.trim();
  if (history[0] === visible) {
    return history;
  }

  const others = history.filter((entry) => normalizeSearchText(entry) !== key);

  return [visible, ...others].slice(0, MAX_SEARCH_HISTORY);
}

/** Removes the entry with the same identity as `text`. Not found (or an empty form): no change. */
export function removeSearch(history: SearchHistory, text: string): SearchHistory {
  const key = normalizeSearchText(text);
  if (key === '') {
    return history;
  }

  const remaining = history.filter((entry) => normalizeSearchText(entry) !== key);

  return remaining.length === history.length ? history : remaining;
}

/** "Clear all". An already empty history comes back as it is. */
export function clearHistory(history: SearchHistory): SearchHistory {
  return history.length === 0 ? history : EMPTY_SEARCH_HISTORY;
}

/**
 * Reads a persisted history back (Day 4, spec 004 RF-12). Storage is outside the app's control
 * (an older build, a corrupt file, a hand edit), so the value arrives as `unknown`.
 *
 * It accepts only what the rules above can produce: an array of at most `MAX_SEARCH_HISTORY`
 * strings, each already trimmed with a non-empty identity and no identity repeated, and keeps it
 * intact in the same order. Anything else becomes the empty history AS A WHOLE: repairing a broken
 * history (dropping one entry, cutting the tail) would invent an order the user never produced.
 * The rules are reused (`normalizeSearchText`, `MAX_SEARCH_HISTORY`), not duplicated.
 */
export function restoreSearchHistory(stored: unknown): SearchHistory {
  if (!Array.isArray(stored) || stored.length === 0 || stored.length > MAX_SEARCH_HISTORY) {
    return EMPTY_SEARCH_HISTORY;
  }

  const identities = new Set<string>();
  for (const entry of stored) {
    if (typeof entry !== 'string' || entry !== entry.trim()) {
      return EMPTY_SEARCH_HISTORY;
    }

    const key = normalizeSearchText(entry);
    if (key === '' || identities.has(key)) {
      return EMPTY_SEARCH_HISTORY;
    }
    identities.add(key);
  }

  return [...(stored as string[])];
}
