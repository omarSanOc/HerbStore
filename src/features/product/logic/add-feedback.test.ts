/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AddOutcome } from '../../cart/logic/add-to-cart.ts';
import {
  describeAddOutcome,
  FEEDBACK_HOLD_MS,
  INITIAL_ADD_FEEDBACK,
  nextAddFeedback,
  resolveFeedbackMotion,
} from './add-feedback.ts';

describe('describeAddOutcome: the message the person reads and hears (RF-6, RF-7)', () => {
  it('says "added" with the units that were added', () => {
    const outcome: AddOutcome = { status: 'added', addedUnits: 3, quantityInCart: 3, limited: false };

    assert.deepEqual(describeAddOutcome(outcome), {
      tone: 'success',
      parts: [{ key: 'added', count: 3 }],
    });
  });

  it('adds the limit sentence, with the units now in the cart, when the maximum was reached', () => {
    const outcome: AddOutcome = { status: 'added', addedUnits: 1, quantityInCart: 3, limited: true };

    assert.deepEqual(describeAddOutcome(outcome), {
      tone: 'limit',
      parts: [
        { key: 'added', count: 1 },
        { key: 'maxInCart', count: 3 },
      ],
    });
  });

  it('when nothing could be added it only says the cart keeps the maximum', () => {
    assert.deepEqual(describeAddOutcome({ status: 'at-limit', quantityInCart: 3 }), {
      tone: 'limit',
      parts: [{ key: 'maxInCart', count: 3 }],
    });
  });

  it('explains why a locked cart or a sold out product was not changed', () => {
    assert.deepEqual(describeAddOutcome({ status: 'locked' }), {
      tone: 'blocked',
      parts: [{ key: 'locked' }],
    });
    assert.deepEqual(describeAddOutcome({ status: 'sold-out' }), {
      tone: 'blocked',
      parts: [{ key: 'soldOut' }],
    });
  });

  it('says nothing for an ignored press', () => {
    assert.equal(describeAddOutcome({ status: 'ignored' }), undefined);
  });
});

describe('nextAddFeedback: every message is a new event, even if the text is the same', () => {
  const model = { tone: 'success', parts: [{ key: 'added', count: 1 }] } as const;

  it('starts with nothing to show', () => {
    assert.equal(INITIAL_ADD_FEEDBACK.id, 0);
    assert.equal(INITIAL_ADD_FEEDBACK.model, undefined);
  });

  it('a new message gets the next id so the animation restarts', () => {
    const first = nextAddFeedback(INITIAL_ADD_FEEDBACK, model);
    const second = nextAddFeedback(first, model);

    assert.deepEqual(first, { id: 1, model });
    assert.equal(second.id, 2);
    assert.equal(second.model, model);
  });

  it('does not mutate the previous state', () => {
    const before = Object.freeze({ id: 4, model });

    const after = nextAddFeedback(before, { tone: 'blocked', parts: [{ key: 'soldOut' }] });

    assert.equal(before.id, 4);
    assert.equal(after.id, 5);
  });
});

describe('resolveFeedbackMotion: reduced motion removes the movement, not the message (RNF-2)', () => {
  it('moves and scales the message in when motion is allowed', () => {
    const motion = resolveFeedbackMotion(false);

    assert.equal(motion.animated, true);
    assert.ok(motion.startOffsetY > 0, 'it travels in from below');
    assert.ok(motion.startScale > 0 && motion.startScale < 1, 'it grows to its size');
    assert.ok(motion.fadeInMs > 0);
    assert.ok(motion.fadeOutMs > 0);
  });

  it('shows it with no travel, no scale and no fade when motion is reduced', () => {
    const motion = resolveFeedbackMotion(true);

    assert.equal(motion.animated, false);
    assert.equal(motion.startOffsetY, 0);
    assert.equal(motion.startScale, 1);
    assert.equal(motion.fadeInMs, 0);
    assert.equal(motion.fadeOutMs, 0);
  });

  it('keeps the message on screen just as long with reduced motion', () => {
    assert.equal(resolveFeedbackMotion(true).holdMs, resolveFeedbackMotion(false).holdMs);
    assert.equal(resolveFeedbackMotion(true).holdMs, FEEDBACK_HOLD_MS);
  });

  it('holds long enough to be read', () => {
    assert.ok(FEEDBACK_HOLD_MS >= 1500);
    assert.ok(FEEDBACK_HOLD_MS <= 4000);
  });
});
