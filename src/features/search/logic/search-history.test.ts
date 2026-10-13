/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addSearch,
  clearHistory,
  EMPTY_SEARCH_HISTORY,
  MAX_SEARCH_HISTORY,
  removeSearch,
  restoreSearchHistory,
  type SearchHistory,
} from './search-history.ts';

/** Frozen history: any write in the code under test throws (the test files are strict). */
function frozen(entries: readonly string[]): SearchHistory {
  return Object.freeze([...entries]);
}

/** `n` distinct searches, `search 1` ... `search n`. */
function searches(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `search ${index + 1}`);
}

describe('MAX_SEARCH_HISTORY', () => {
  it('is 10 (spec 003, Definitions)', () => {
    assert.equal(MAX_SEARCH_HISTORY, 10);
  });
});

describe('addSearch', () => {
  it('adds the first search', () => {
    assert.deepEqual(addSearch(EMPTY_SEARCH_HISTORY, 'Vitamina C'), ['Vitamina C']);
  });

  it('puts the newest search first', () => {
    const history = addSearch(frozen(['zinc']), 'omega 3');
    assert.deepEqual(history, ['omega 3', 'zinc']);
  });

  it('keeps ONE entry for "Vitamina C" and "vitamina  c", with the most recent variant first', () => {
    const first = addSearch(EMPTY_SEARCH_HISTORY, 'Vitamina C');
    const second = addSearch(first, 'vitamina  c');

    assert.deepEqual(second, ['vitamina  c']);
  });

  it('keeps the human variant, not the normalized form (case and diacritics survive)', () => {
    const history = addSearch(EMPTY_SEARCH_HISTORY, '  Vitamina Ç  ');
    // Only the outer spaces go: they are not part of any variant.
    assert.deepEqual(history, ['Vitamina Ç']);
  });

  it('treats case, diacritics and inner spaces as the same identity and moves the entry to the top', () => {
    const history = frozen(['magnesio', 'Vitamina C', 'zinc']);
    const next = addSearch(history, 'VITAMÍNA   c');

    assert.deepEqual(next, ['VITAMÍNA   c', 'magnesio', 'zinc']);
  });

  it('merges "Vitamina" and "vitamína" (diacritic only)', () => {
    const next = addSearch(frozen(['Vitamina']), 'vitamína');
    assert.deepEqual(next, ['vitamína']);
  });

  it('moves an existing entry from the middle or the end to the top without duplicating', () => {
    const history = frozen(['a', 'b', 'c', 'd']);
    assert.deepEqual(addSearch(history, 'c'), ['c', 'a', 'b', 'd']);
    assert.deepEqual(addSearch(history, 'd'), ['d', 'a', 'b', 'c']);
  });

  it('searching the same text again as the first entry keeps the same history', () => {
    const history = frozen(['vitamina c', 'zinc']);
    assert.equal(addSearch(history, 'vitamina c'), history);
  });

  it('keeps at most 10 entries: the 11th removes the OLDEST', () => {
    let history: SearchHistory = EMPTY_SEARCH_HISTORY;
    for (const text of searches(10)) {
      history = addSearch(history, text);
    }
    assert.equal(history.length, 10);
    assert.equal(history[9], 'search 1');

    history = addSearch(history, 'search 11');

    assert.equal(history.length, 10);
    assert.equal(history[0], 'search 11');
    assert.equal(history[9], 'search 2');
    assert.equal(history.includes('search 1'), false);
  });

  it('an existing entry at the limit does not push anything out', () => {
    let history: SearchHistory = EMPTY_SEARCH_HISTORY;
    for (const text of searches(10)) {
      history = addSearch(history, text);
    }
    const next = addSearch(history, 'SEARCH 1');

    assert.equal(next.length, 10);
    assert.equal(next[0], 'SEARCH 1');
    assert.equal(next.includes('search 10'), true);
  });

  it('never stores an empty normalized form: empty, spaces, tabs and lone combining marks', () => {
    const history = frozen(['zinc']);
    for (const text of ['', ' ', '   ', '\t\n ', '́']) {
      assert.equal(addSearch(history, text), history, JSON.stringify(text));
    }
    assert.deepEqual(addSearch(EMPTY_SEARCH_HISTORY, '   '), []);
  });

  it('never mutates the input history', () => {
    const history = frozen(['a', 'b', 'c']);
    const snapshot = [...history];

    addSearch(history, 'b');
    addSearch(history, 'new');
    addSearch(history, '   ');

    assert.deepEqual(history, snapshot);
  });

  it('returns a new array when something changes', () => {
    const history = frozen(['a']);
    assert.notEqual(addSearch(history, 'b'), history);
  });
});

describe('removeSearch', () => {
  it('removes one entry and keeps the order of the rest', () => {
    assert.deepEqual(removeSearch(frozen(['a', 'b', 'c']), 'b'), ['a', 'c']);
  });

  it('finds the entry by identity: another spelling of the same text removes it', () => {
    assert.deepEqual(removeSearch(frozen(['Vitamina C', 'zinc']), '  vitamína  c '), ['zinc']);
  });

  it('a text that is not in the history changes nothing and returns the same history', () => {
    const history = frozen(['a', 'b']);
    assert.equal(removeSearch(history, 'x'), history);
  });

  it('an empty normalized text changes nothing', () => {
    const history = frozen(['a']);
    assert.equal(removeSearch(history, '   '), history);
  });

  it('never mutates the input history', () => {
    const history = frozen(['a', 'b']);
    removeSearch(history, 'a');
    assert.deepEqual(history, ['a', 'b']);
  });
});

describe('clearHistory', () => {
  it('removes every entry', () => {
    assert.deepEqual(clearHistory(frozen(searches(10))), []);
  });

  it('clearing an empty history returns the same history', () => {
    assert.equal(clearHistory(EMPTY_SEARCH_HISTORY), EMPTY_SEARCH_HISTORY);
  });

  it('never mutates the input history', () => {
    const history = frozen(['a', 'b']);
    clearHistory(history);
    assert.deepEqual(history, ['a', 'b']);
  });
});

describe('restoreSearchHistory (Day 4: reading the persisted history back)', () => {
  it('keeps a valid history intact, in the same order', () => {
    const stored = ['vitamina  c', 'Magnesio', 'Zinc Ç'];
    assert.deepEqual(restoreSearchHistory(stored), ['vitamina  c', 'Magnesio', 'Zinc Ç']);
  });

  it('keeps a full history of exactly MAX_SEARCH_HISTORY entries', () => {
    const stored = searches(MAX_SEARCH_HISTORY);
    assert.deepEqual(restoreSearchHistory(stored), stored);
  });

  it('accepts a history that the rules produced (round trip with addSearch)', () => {
    let history: SearchHistory = EMPTY_SEARCH_HISTORY;
    for (const text of [...searches(12), '  Vitamina C ', 'vitamína c']) {
      history = addSearch(history, text);
    }
    const stored: unknown = JSON.parse(JSON.stringify(history));

    assert.deepEqual(restoreSearchHistory(stored), history);
  });

  it('an empty stored array gives the empty history', () => {
    assert.equal(restoreSearchHistory([]), EMPTY_SEARCH_HISTORY);
  });

  for (const [label, stored] of [
    ['undefined (nothing stored)', undefined],
    ['null', null],
    ['a string', 'vitamina c'],
    ['a number', 42],
    ['an object', { entries: ['a'] }],
  ] as const) {
    it(`something that is not an array (${label}) gives the empty history`, () => {
      assert.equal(restoreSearchHistory(stored), EMPTY_SEARCH_HISTORY);
    });
  }

  for (const [label, stored] of [
    ['a non-string entry', ['zinc', 7]],
    ['a null entry', ['zinc', null]],
    ['an empty entry', ['zinc', '']],
    ['an entry of only spaces', ['zinc', '   ']],
    ['an entry with outer spaces (the rules always trim)', ['zinc', ' magnesio ']],
  ] as const) {
    it(`a corrupt history with ${label} is discarded as a whole`, () => {
      assert.equal(restoreSearchHistory(stored), EMPTY_SEARCH_HISTORY);
    });
  }

  it('duplicated identities ("Vitamina C" and "vitamína  c") make the history invalid', () => {
    assert.equal(restoreSearchHistory(['Vitamina C', 'zinc', 'vitamína  c']), EMPTY_SEARCH_HISTORY);
  });

  it('more than MAX_SEARCH_HISTORY entries make the history invalid', () => {
    assert.equal(restoreSearchHistory(searches(MAX_SEARCH_HISTORY + 1)), EMPTY_SEARCH_HISTORY);
  });

  it('never mutates the stored value', () => {
    const stored = Object.freeze(['b', 'a']);
    restoreSearchHistory(stored);
    assert.deepEqual(stored, ['b', 'a']);
  });

  it('the restored history still follows addSearch/removeSearch/clearHistory', () => {
    const restored = restoreSearchHistory(['zinc', 'Vitamina C']);

    assert.deepEqual(addSearch(restored, 'vitamina c'), ['vitamina c', 'zinc']);
    assert.deepEqual(removeSearch(restored, 'ZINC'), ['Vitamina C']);
    assert.deepEqual(clearHistory(restored), []);
  });
});
