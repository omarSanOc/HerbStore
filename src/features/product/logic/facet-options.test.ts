/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CategoryNode } from '../contracts/catalog-product.ts';
import { selectSubcategoryOptions } from './facet-options.ts';

const tree: readonly CategoryNode[] = [
  {
    id: 'vitamins',
    name: 'Vitamins',
    productCount: 60,
    subcategories: [
      { id: 'vitamin-c', name: 'Vitamin C', productCount: 20 },
      { id: 'vitamin-d', name: 'Vitamin D', productCount: 20 },
    ],
  },
  {
    id: 'minerals',
    name: 'Minerals',
    productCount: 60,
    subcategories: [{ id: 'zinc', name: 'Zinc', productCount: 20 }],
  },
];

describe('selectSubcategoryOptions', () => {
  it('gives only the subcategories of the current category, in the order of the server', () => {
    assert.deepEqual(selectSubcategoryOptions(tree, 'vitamins'), [
      { id: 'vitamin-c', name: 'Vitamin C' },
      { id: 'vitamin-d', name: 'Vitamin D' },
    ]);
    assert.deepEqual(selectSubcategoryOptions(tree, 'minerals'), [{ id: 'zinc', name: 'Zinc' }]);
  });

  it('gives all of them, category after category, when there is no category (search)', () => {
    assert.deepEqual(
      selectSubcategoryOptions(tree, undefined).map((option) => option.id),
      ['vitamin-c', 'vitamin-d', 'zinc'],
    );
  });

  it('compares the category by its normalized form, like the server does', () => {
    assert.deepEqual(
      selectSubcategoryOptions(tree, ' VITAMINS ').map((option) => option.id),
      ['vitamin-c', 'vitamin-d'],
    );
  });

  it('gives nothing for a category the server does not know (no invented options)', () => {
    assert.deepEqual(selectSubcategoryOptions(tree, 'does-not-exist'), []);
  });

  it('does not repeat a subcategory id that two categories carry', () => {
    const repeated: readonly CategoryNode[] = [
      { id: 'a', name: 'A', productCount: 1, subcategories: [{ id: 'x', name: 'X', productCount: 1 }] },
      { id: 'b', name: 'B', productCount: 1, subcategories: [{ id: 'x', name: 'X again', productCount: 1 }] },
    ];
    assert.deepEqual(selectSubcategoryOptions(repeated, undefined), [{ id: 'x', name: 'X' }]);
  });

  it('gives an empty list for an empty tree', () => {
    assert.deepEqual(selectSubcategoryOptions([], 'vitamins'), []);
    assert.deepEqual(selectSubcategoryOptions([], undefined), []);
  });
});
