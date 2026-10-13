/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createModalSheetRegistry } from './modal-sheet-registry.ts';

describe('createModalSheetRegistry', () => {
  it('starts with no sheet open', () => {
    assert.equal(createModalSheetRegistry().isAnyOpen(), false);
  });

  it('is open while at least one sheet is open', () => {
    const registry = createModalSheetRegistry();
    registry.setOpen('sort', true);
    assert.equal(registry.isAnyOpen(), true);
    registry.setOpen('advanced', true);
    registry.setOpen('sort', false);
    assert.equal(registry.isAnyOpen(), true);
    registry.setOpen('advanced', false);
    assert.equal(registry.isAnyOpen(), false);
  });

  it('is idempotent: opening twice and closing once leaves it closed', () => {
    const registry = createModalSheetRegistry();
    registry.setOpen('sort', true);
    registry.setOpen('sort', true);
    registry.setOpen('sort', false);
    assert.equal(registry.isAnyOpen(), false);
  });

  it('closing a sheet that was never open changes nothing', () => {
    const registry = createModalSheetRegistry();
    registry.setOpen('sort', false);
    assert.equal(registry.isAnyOpen(), false);
  });

  it('notifies listeners only when the overall state flips', () => {
    const registry = createModalSheetRegistry();
    let calls = 0;
    const unsubscribe = registry.subscribe(() => {
      calls += 1;
    });

    registry.setOpen('sort', true);
    registry.setOpen('sort', true);
    registry.setOpen('advanced', true);
    assert.equal(calls, 1);

    registry.setOpen('sort', false);
    assert.equal(calls, 1);
    registry.setOpen('advanced', false);
    assert.equal(calls, 2);

    unsubscribe();
    registry.setOpen('sort', true);
    assert.equal(calls, 2);
  });
});
