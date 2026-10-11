/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  initialBannerInteraction,
  isBannerInteracting,
  reduceBannerInteraction,
  type BannerInteractionEvent,
  type BannerInteractionState,
} from './banner-interaction.ts';

function run(events: readonly BannerInteractionEvent[]): BannerInteractionState {
  return events.reduce(reduceBannerInteraction, initialBannerInteraction);
}

describe('reduceBannerInteraction', () => {
  it('starts idle', () => {
    assert.equal(isBannerInteracting(initialBannerInteraction), false);
    assert.equal(initialBannerInteraction.epoch, 0);
  });

  it('a tap is an interaction from touch start to touch end', () => {
    assert.equal(isBannerInteracting(run(['touchStart'])), true);
    const tapped = run(['touchStart', 'touchEnd']);
    assert.equal(isBannerInteracting(tapped), false);
    assert.equal(tapped.epoch, 1);
  });

  it('a drag keeps interacting until the finger lifts, in any event order', () => {
    // Android: the native scroll cancels the JS touch when the drag begins.
    const android = run(['touchStart', 'dragStart', 'touchEnd']);
    assert.equal(isBannerInteracting(android), true);
    assert.equal(isBannerInteracting(reduceBannerInteraction(android, 'dragEnd')), false);

    // Same events, cancel arriving before the drag start.
    const cancelFirst = run(['touchStart', 'touchEnd', 'dragStart']);
    assert.equal(isBannerInteracting(cancelFirst), true);
    assert.equal(isBannerInteracting(reduceBannerInteraction(cancelFirst, 'dragEnd')), false);

    // iOS: touches keep arriving during the drag, and the lift can report either first.
    const touchEndsFirst = run(['touchStart', 'dragStart', 'touchEnd', 'dragEnd']);
    const dragEndsFirst = run(['touchStart', 'dragStart', 'dragEnd', 'touchEnd']);
    assert.equal(isBannerInteracting(touchEndsFirst), false);
    assert.equal(isBannerInteracting(dragEndsFirst), false);
  });

  it('the end of a drag also ends the touch (the finger is up) so nothing stays stuck', () => {
    const state = run(['touchStart', 'dragStart', 'dragEnd']);
    assert.equal(state.touching, false);
    assert.equal(isBannerInteracting(state), false);
  });

  it('every real end bumps the epoch, so the wait restarts even if the flags flip in one batch', () => {
    assert.equal(run(['touchStart', 'touchEnd']).epoch, 1);
    assert.equal(run(['touchStart', 'touchEnd', 'touchStart', 'touchEnd']).epoch, 2);
    assert.equal(run(['dragStart', 'dragEnd']).epoch, 1);
  });

  it('ignores ends that never started (a programmatic scroll sends no touch or drag)', () => {
    const idle = initialBannerInteraction;
    assert.equal(reduceBannerInteraction(idle, 'touchEnd'), idle);
    assert.equal(reduceBannerInteraction(idle, 'dragEnd'), idle);
    assert.equal(reduceBannerInteraction(idle, 'reset'), idle);
  });

  it('repeated starts change nothing', () => {
    const touching = run(['touchStart']);
    assert.equal(reduceBannerInteraction(touching, 'touchStart'), touching);
    const dragging = run(['dragStart']);
    assert.equal(reduceBannerInteraction(dragging, 'dragStart'), dragging);
  });

  it('reset clears a stuck gesture without pretending the user finished one', () => {
    const stuck = run(['touchStart', 'dragStart']);
    const cleared = reduceBannerInteraction(stuck, 'reset');
    assert.equal(isBannerInteracting(cleared), false);
    assert.equal(cleared.epoch, stuck.epoch);
  });
});
