/// <reference types="node" />
// RF-9, RF-22 (spec 007, T3). `category-labels` no longer holds any translation table: category,
// subcategory and section names are copy OF THE CATALOG, owned by the localized API response. What
// remains is the safe initial used when a circular image cannot load, plus a guard that keeps the
// tables from coming back through this module.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as categoryLabels from './category-labels.ts';
import { categoryInitial } from './category-labels.ts';

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

describe('the module', () => {
  it('exports ONLY the initial: no table or key of catalog copy is left here', () => {
    assert.deepEqual(Object.keys(categoryLabels).sort(), ['categoryInitial']);
  });
});
