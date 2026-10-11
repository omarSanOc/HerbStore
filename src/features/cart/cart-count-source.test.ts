/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createCartCountSource } from './cart-count-source.ts';

describe('createCartCountSource', () => {
  it('starts at the initial count', () => {
    assert.equal(createCartCountSource().getSnapshot(), 0);
    assert.equal(createCartCountSource(7).getSnapshot(), 7);
  });

  it('adds units and notifies subscribers', () => {
    const source = createCartCountSource();
    let notifications = 0;
    source.subscribe(() => {
      notifications += 1;
    });

    source.add(1);
    source.add(10);

    assert.equal(source.getSnapshot(), 11);
    assert.equal(notifications, 2);
  });

  it('resets to zero and does not notify when nothing changed', () => {
    const source = createCartCountSource(3);
    let notifications = 0;
    source.subscribe(() => {
      notifications += 1;
    });

    source.reset();
    source.reset();

    assert.equal(source.getSnapshot(), 0);
    assert.equal(notifications, 1);
  });

  it('never goes below zero', () => {
    const source = createCartCountSource(2);
    source.add(-5);
    assert.equal(source.getSnapshot(), 0);
  });

  it('stops notifying after unsubscribe', () => {
    const source = createCartCountSource();
    let notifications = 0;
    const unsubscribe = source.subscribe(() => {
      notifications += 1;
    });

    unsubscribe();
    source.add(1);

    assert.equal(notifications, 0);
  });
});
