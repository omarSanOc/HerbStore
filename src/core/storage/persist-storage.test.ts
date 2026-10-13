/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSafeStorage, type KeyValueBackend, type StorageFailure } from './persist-storage.ts';

/** An in-memory backend with the same synchronous shape as MMKV. */
function memoryBackend(initial: Record<string, string> = {}): KeyValueBackend & {
  readonly values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => values.delete(key),
  };
}

function failing(message: string): never {
  throw new Error(message);
}

/** Records the reported failures (operation only: values must never reach a report). */
function failureLog(): { readonly failures: StorageFailure[]; onError: (failure: StorageFailure) => void } {
  const failures: StorageFailure[] = [];
  return { failures, onError: (failure) => failures.push(failure) };
}

describe('createSafeStorage', () => {
  it('reads what is stored and gives null for a missing key', async () => {
    const storage = createSafeStorage(() => memoryBackend({ 'persist:root': '{"a":"1"}' }));

    assert.equal(await storage.getItem('persist:root'), '{"a":"1"}');
    assert.equal(await storage.getItem('missing'), null);
  });

  it('writes and removes through the backend', async () => {
    const backend = memoryBackend();
    const storage = createSafeStorage(() => backend);

    await storage.setItem('persist:root', 'value');
    assert.equal(backend.values.get('persist:root'), 'value');

    await storage.removeItem('persist:root');
    assert.equal(backend.values.has('persist:root'), false);
  });

  it('a read error resolves null (empty state) instead of rejecting, and is reported', async () => {
    const log = failureLog();
    const storage = createSafeStorage(
      () => ({ ...memoryBackend(), getString: () => failing('disk read failed') }),
      log.onError,
    );

    assert.equal(await storage.getItem('persist:root'), null);
    assert.deepEqual(
      log.failures.map(({ operation }) => operation),
      ['read'],
    );
  });

  it('a backend that cannot be opened behaves as an empty storage and never rejects', async () => {
    const log = failureLog();
    let opened = 0;
    const storage = createSafeStorage(() => {
      opened += 1;
      return failing('native module missing');
    }, log.onError);

    assert.equal(await storage.getItem('persist:root'), null);
    await storage.setItem('persist:root', 'value');
    await storage.removeItem('persist:root');

    // Opened lazily and only once: a broken backend is not retried on every write.
    assert.equal(opened, 1);
    assert.deepEqual(
      log.failures.map(({ operation }) => operation),
      ['open'],
    );
  });

  it('a write or remove error resolves (the app keeps running) and is reported', async () => {
    const log = failureLog();
    const storage = createSafeStorage(
      () => ({
        getString: () => undefined,
        set: () => failing('disk full'),
        remove: () => failing('locked'),
      }),
      log.onError,
    );

    await storage.setItem('persist:root', 'value');
    await storage.removeItem('persist:root');

    assert.deepEqual(
      log.failures.map(({ operation }) => operation),
      ['write', 'remove'],
    );
  });

  it('a report never carries the stored value', async () => {
    const log = failureLog();
    const storage = createSafeStorage(
      () => ({ ...memoryBackend(), set: () => failing('disk full') }),
      log.onError,
    );

    await storage.setItem('persist:root', 'SECRET-LOOKING-VALUE');

    assert.equal(JSON.stringify(log.failures).includes('SECRET-LOOKING-VALUE'), false);
  });

  it('opens the backend lazily: creating the adapter does not touch it', () => {
    let opened = 0;
    createSafeStorage(() => {
      opened += 1;
      return memoryBackend();
    });

    assert.equal(opened, 0);
  });
});
