/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runOptionalFeedback } from './optional-feedback.ts';

describe('runOptionalFeedback (feedback is polish, never the source of truth)', () => {
  it('reports true when the native effect runs', async () => {
    let calls = 0;

    const ran = await runOptionalFeedback(async () => {
      calls += 1;
    });

    assert.equal(ran, true);
    assert.equal(calls, 1);
  });

  it('absorbs a rejected promise (unsupported actuator, module missing, permission off)', async () => {
    const ran = await runOptionalFeedback(() => Promise.reject(new Error('no actuator')));

    assert.equal(ran, false);
  });

  it('absorbs a synchronous throw as well', async () => {
    const ran = await runOptionalFeedback(() => {
      throw new Error('ExpoHaptics is not available');
    });

    assert.equal(ran, false);
  });

  it('accepts an effect that returns nothing at all', async () => {
    assert.equal(await runOptionalFeedback(() => undefined), true);
  });
});
