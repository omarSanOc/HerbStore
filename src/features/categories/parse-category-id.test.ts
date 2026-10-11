/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCategoryId } from './parse-category-id.ts';

describe('parseCategoryId', () => {
  it('accepts the ids the server uses', () => {
    for (const id of ['vitamins', 'minerals', 'protein', 'botanicals', 'wellness']) {
      assert.equal(parseCategoryId(id), id);
    }
  });

  it('accepts well-formed ids that may not exist (existence is the server concern)', () => {
    assert.equal(parseCategoryId('sports-nutrition'), 'sports-nutrition');
    assert.equal(parseCategoryId('omega3'), 'omega3');
  });

  it('rejects missing values and non-strings', () => {
    assert.equal(parseCategoryId(undefined), undefined);
    assert.equal(parseCategoryId(null), undefined);
    assert.equal(parseCategoryId(''), undefined);
    assert.equal(parseCategoryId(12), undefined);
    assert.equal(parseCategoryId({ id: 'vitamins' }), undefined);
  });

  it('rejects repeated route params (arrays)', () => {
    assert.equal(parseCategoryId(['vitamins']), undefined);
    assert.equal(parseCategoryId(['vitamins', 'minerals']), undefined);
  });

  it('rejects padded, uppercase and URL-altering values', () => {
    for (const value of [' vitamins', 'vitamins ', ' ', 'Vitamins', '../x', 'a/b', 'a?b=1', 'a#b', 'a%2Fb', 'a b', '-vitamins', 'vitamins\n']) {
      assert.equal(parseCategoryId(value), undefined, JSON.stringify(value));
    }
  });

  it('rejects ids that are too long', () => {
    assert.equal(parseCategoryId('a'.repeat(40)), 'a'.repeat(40));
    assert.equal(parseCategoryId('a'.repeat(41)), undefined);
  });
});
