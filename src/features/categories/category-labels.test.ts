/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  categoryInitial,
  categoryLabelKey,
  KNOWN_CATEGORY_IDS,
  KNOWN_SUBCATEGORY_IDS,
  subcategoryLabelKey,
} from './category-labels.ts';

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

describe('subcategoryLabelKey', () => {
  // Three subcategories in each of the five categories of the mock catalog (`GET /categories`).
  const expected = [
    ['multivitamins', 'subcategories.multivitamins'],
    ['vitamin-c', 'subcategories.vitaminC'],
    ['vitamin-d', 'subcategories.vitaminD'],
    ['magnesium', 'subcategories.magnesium'],
    ['zinc', 'subcategories.zinc'],
    ['calcium', 'subcategories.calcium'],
    ['plant-protein', 'subcategories.plantProtein'],
    ['whey-protein', 'subcategories.wheyProtein'],
    ['amino-blends', 'subcategories.aminoBlends'],
    ['herbal-blends', 'subcategories.herbalBlends'],
    ['mushroom-blends', 'subcategories.mushroomBlends'],
    ['root-extracts', 'subcategories.rootExtracts'],
    ['probiotics', 'subcategories.probiotics'],
    ['omegas', 'subcategories.omegas'],
    ['sleep-support', 'subcategories.sleepSupport'],
  ] as const;

  it('knows exactly the 15 subcategories of the catalog', () => {
    assert.equal(expected.length, 15);
    assert.deepEqual([...KNOWN_SUBCATEGORY_IDS], expected.map(([id]) => id));
  });

  it('has a translation key for each of the 15 known subcategories', () => {
    for (const [id, key] of expected) {
      assert.equal(subcategoryLabelKey(id), key, id);
    }
  });

  it('gives undefined for any other id so the caller shows the server text', () => {
    for (const id of ['', 'vitamin-e', 'Vitamin-C', ' zinc', 'zinc ', 'vitaminC', 'vitamins', 'multivitamins,zinc']) {
      assert.equal(subcategoryLabelKey(id), undefined, id);
    }
  });

  it('is not fooled by object prototype names', () => {
    for (const id of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      assert.equal(subcategoryLabelKey(id), undefined, id);
    }
  });
});
