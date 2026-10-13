/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveSearchView, resolveSubmittedText, SEARCH_DEBOUNCE_MS } from './search-view.ts';

describe('SEARCH_DEBOUNCE_MS', () => {
  it('is 400 ms (RF-16)', () => {
    assert.equal(SEARCH_DEBOUNCE_MS, 400);
  });
});

describe('resolveSearchView', () => {
  describe('history (no query)', () => {
    it('shows the history for an empty field', () => {
      assert.deepEqual(resolveSearchView({ rawText: '', debouncedText: '' }), { kind: 'history' });
    });

    it('shows the history for a field with only spaces, tabs or new lines', () => {
      for (const rawText of [' ', '     ', '\t', ' \n ']) {
        assert.deepEqual(resolveSearchView({ rawText, debouncedText: '' }), { kind: 'history' });
      }
    });

    it('raw empty but debounced not yet: history, not pending (the user just cleared the field)', () => {
      assert.deepEqual(resolveSearchView({ rawText: '', debouncedText: 'vitamina' }), {
        kind: 'history',
      });
      assert.deepEqual(resolveSearchView({ rawText: '   ', debouncedText: 'vitamina' }), {
        kind: 'history',
      });
    });

    it('raw empty wins even when the debounced text has the same empty form', () => {
      assert.deepEqual(resolveSearchView({ rawText: '  ', debouncedText: '   ' }), {
        kind: 'history',
      });
    });
  });

  describe('pending (waiting for the debounce)', () => {
    it('raw text different from the debounced one', () => {
      assert.deepEqual(resolveSearchView({ rawText: 'vita', debouncedText: 'vit' }), {
        kind: 'pending',
      });
    });

    it('raw text not empty but debounced still empty: the first keystrokes', () => {
      assert.deepEqual(resolveSearchView({ rawText: 'v', debouncedText: '' }), { kind: 'pending' });
      assert.deepEqual(resolveSearchView({ rawText: 'v', debouncedText: '   ' }), {
        kind: 'pending',
      });
    });

    it('a different word is pending even when it shares a prefix with the debounced one', () => {
      assert.deepEqual(resolveSearchView({ rawText: 'zinc', debouncedText: 'zin' }), {
        kind: 'pending',
      });
    });
  });

  describe('query', () => {
    it('same text: a query with the normalized form', () => {
      assert.deepEqual(resolveSearchView({ rawText: 'vitamina', debouncedText: 'vitamina' }), {
        kind: 'query',
        q: 'vitamina',
      });
    });

    it('q is the NORMALIZED form: trim, collapsed spaces, lowercase, no diacritics', () => {
      assert.deepEqual(
        resolveSearchView({ rawText: '  VITAMÍNA   Ç ', debouncedText: '  VITAMÍNA   Ç ' }),
        { kind: 'query', q: 'vitamina c' },
      );
    });

    it('texts that differ only in case, diacritics or spaces are the SAME search (no pending)', () => {
      // "Vitamina" -> "Vitamina " (a trailing space) is not a new search: same identity.
      assert.deepEqual(resolveSearchView({ rawText: 'Vitamina ', debouncedText: 'Vitamina' }), {
        kind: 'query',
        q: 'vitamina',
      });
      assert.deepEqual(resolveSearchView({ rawText: 'VITAMÍNA', debouncedText: 'vitamina' }), {
        kind: 'query',
        q: 'vitamina',
      });
      assert.deepEqual(resolveSearchView({ rawText: 'vitamina  c', debouncedText: 'vitamina c' }), {
        kind: 'query',
        q: 'vitamina c',
      });
    });
  });
});

describe('resolveSubmittedText (S-2: the search key can arrive before React renders the last key)', () => {
  it('sends the text of the submit event, even when the rendered state is behind', () => {
    // The user typed "tablets" and pressed search within 0.3 s: state still says "t".
    assert.equal(resolveSubmittedText('tablets', 't'), 'tablets');
    assert.equal(resolveSubmittedText('daily', 'd'), 'daily');
  });

  it('keeps the visible variant (case and inner spaces) untouched', () => {
    assert.equal(resolveSubmittedText('Magnesium  Glycinate ', 'Magnesium'), 'Magnesium  Glycinate ');
  });

  it('an empty event text is a real value (the field was emptied), not a missing one', () => {
    assert.equal(resolveSubmittedText('', 'old'), '');
  });

  it('falls back to the field state only when the event carries no text', () => {
    assert.equal(resolveSubmittedText(undefined, 'zinc powder'), 'zinc powder');
  });
});
