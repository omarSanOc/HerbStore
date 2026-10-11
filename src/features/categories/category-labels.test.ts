/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { categoryInitial, categoryLabelKey, KNOWN_CATEGORY_IDS } from './category-labels.ts';

describe('categoryLabelKey', () => {
  it('has a translation key for each of the five catalog categories', () => {
    assert.deepEqual([...KNOWN_CATEGORY_IDS], ['vitamins', 'minerals', 'protein', 'botanicals', 'wellness']);
    for (const id of KNOWN_CATEGORY_IDS) {
      assert.equal(categoryLabelKey(id), `home.categories.${id}`);
    }
  });

  it('gives undefined for ids without translation so the caller shows the server text', () => {
    assert.equal(categoryLabelKey('herbs'), undefined);
    assert.equal(categoryLabelKey(''), undefined);
    assert.equal(categoryLabelKey('Vitamins'), undefined);
  });

  it('is not fooled by object prototype names', () => {
    assert.equal(categoryLabelKey('constructor'), undefined);
    assert.equal(categoryLabelKey('__proto__'), undefined);
    assert.equal(categoryLabelKey('toString'), undefined);
  });
});

describe('categoryInitial', () => {
  it('is the uppercase first letter, used when the category image fails', () => {
    assert.equal(categoryInitial('vitaminas'), 'V');
    assert.equal(categoryInitial('Minerals'), 'M');
    assert.equal(categoryInitial('  botánicos'), 'B');
  });

  it('keeps accented and astral first characters whole', () => {
    assert.equal(categoryInitial('énergie'), 'É');
    assert.equal(categoryInitial('🌿 Herbs'), '🌿');
  });

  it('falls back to a question mark for an empty name', () => {
    assert.equal(categoryInitial(''), '?');
    assert.equal(categoryInitial('   '), '?');
  });
});
