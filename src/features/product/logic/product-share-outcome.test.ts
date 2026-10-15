/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyShareResult, createShareRunner } from './product-share-outcome.ts';

describe('classifyShareResult', () => {
  it('distinguishes success, cancellation and missing native results', () => {
    assert.equal(classifyShareResult({ action: 'sharedAction' }), 'shared');
    assert.equal(classifyShareResult({ action: 'dismissedAction' }), 'cancelled');
    assert.equal(classifyShareResult(undefined), 'failed');
    assert.equal(classifyShareResult(null), 'failed');
    assert.equal(classifyShareResult({}), 'failed');
  });
});

describe('classifyShareResult: the shapes each platform really returns (RF-27)', () => {
  it('iOS: sharedAction carries the chosen activity, dismissedAction a null one', () => {
    assert.equal(
      classifyShareResult({ action: 'sharedAction', activityType: 'com.apple.UIKit.activity.CopyToPasteboard' }),
      'shared',
    );
    assert.equal(classifyShareResult({ action: 'dismissedAction', activityType: null }), 'cancelled');
  });

  it('Android: RN resolves sharedAction as soon as the chooser opens, so it can never say cancelled', () => {
    assert.equal(classifyShareResult({ action: 'sharedAction', activityType: null }), 'shared');
  });

  it('anything that is not a recognised result object is a missing native result', () => {
    for (const result of ['sharedAction', 'dismissedAction', 42, true, [], ['sharedAction'], { action: 'unknown' }, { action: 1 }, { activityType: 'x' }]) {
      assert.equal(classifyShareResult(result), 'failed', JSON.stringify(result));
    }
  });
});

describe('createShareRunner: one share at a time, every ending classified', () => {
  const never = () => new Promise<never>(() => {});

  it('maps what the native side settles with to shared | cancelled | failed', async () => {
    const run = createShareRunner();

    assert.equal(await run(() => Promise.resolve({ action: 'sharedAction' })), 'shared');
    assert.equal(await run(() => Promise.resolve({ action: 'dismissedAction' })), 'cancelled');
    assert.equal(await run(() => Promise.resolve(undefined)), 'failed');
    assert.equal(await run(() => Promise.resolve({})), 'failed');
  });

  it('turns a rejection into failed', async () => {
    const run = createShareRunner();

    assert.equal(await run(() => Promise.reject(new Error('E_UNABLE_TO_OPEN_DIALOG'))), 'failed');
  });

  it('turns a SYNCHRONOUS throw (RN invariant, missing ShareModule) into failed', async () => {
    const run = createShareRunner();

    assert.equal(
      await run(() => {
        throw new Error('ShareModule should be registered on Android.');
      }),
      'failed',
    );
  });

  it('ignores a second press while the first share has not settled, and calls the native side once', async () => {
    const run = createShareRunner();
    let calls = 0;
    let finish: (value: unknown) => void = () => {};
    const first = run(() => {
      calls += 1;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });

    const second = await run(() => {
      calls += 1;
      return Promise.resolve({ action: 'sharedAction' });
    });
    assert.equal(second, 'ignored');
    assert.equal(calls, 1);

    finish({ action: 'dismissedAction' });
    assert.equal(await first, 'cancelled');
  });

  it('releases the gate after every ending so a retry always runs (success, cancel, failure, throw)', async () => {
    const run = createShareRunner();
    const endings: (() => Promise<unknown>)[] = [
      () => Promise.resolve({ action: 'sharedAction' }),
      () => Promise.resolve({ action: 'dismissedAction' }),
      () => Promise.resolve(undefined),
      () => Promise.reject(new Error('boom')),
      () => {
        throw new Error('sync boom');
      },
    ];

    for (const ending of endings) {
      await run(ending);
      assert.equal(await run(() => Promise.resolve({ action: 'sharedAction' })), 'shared');
    }
  });

  it('keeps a pending share from leaking into another runner (one runner per screen)', async () => {
    const a = createShareRunner();
    const b = createShareRunner();
    void a(never);

    assert.equal(await b(() => Promise.resolve({ action: 'sharedAction' })), 'shared');
  });
});
