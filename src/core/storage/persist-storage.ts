// The storage engine redux-persist writes to, kept free of React Native so it can be tested in
// Node. `mmkv-storage.ts` plugs MMKV in as the backend; this file only decides what a failure
// means: persistence is a convenience, so a broken disk must never close the app (spec 004,
// RF-11 and "Casos límite": empty, corrupt or incompatible state -> empty, no crash).

/** The synchronous key-value surface used from MMKV (`getString`, `set`, `remove`). */
export type KeyValueBackend = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): unknown;
};

/**
 * What a failure report carries: the operation and the error message, never the key's value
 * (the persisted state must not reach a log; RNF-1).
 */
export type StorageFailure = Readonly<{
  operation: 'open' | 'read' | 'write' | 'remove';
  message: string;
}>;

/** The promise-based engine redux-persist expects (its `WebStorage` shape). */
export type PersistStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/**
 * Wraps a backend so every operation RESOLVES:
 * - a read error (or a backend that cannot be opened) resolves `null`, which redux-persist reads
 *   as "nothing stored" and the app starts with the initial state;
 * - a write or remove error resolves too, so redux-persist never sees a rejected promise.
 *
 * The backend is opened lazily on the first operation and only once, even when opening fails:
 * creating the store never touches the disk, and a missing native module is not retried on
 * every write.
 */
export function createSafeStorage(
  openBackend: () => KeyValueBackend,
  onError: (failure: StorageFailure) => void = () => undefined,
): PersistStorage {
  let backend: KeyValueBackend | null | undefined;

  function report(operation: StorageFailure['operation'], error: unknown) {
    onError({ operation, message: messageOf(error) });
  }

  function getBackend(): KeyValueBackend | null {
    if (backend === undefined) {
      try {
        backend = openBackend();
      } catch (error) {
        backend = null;
        report('open', error);
      }
    }
    return backend;
  }

  return {
    getItem(key) {
      const current = getBackend();
      if (current === null) {
        return Promise.resolve(null);
      }

      try {
        return Promise.resolve(current.getString(key) ?? null);
      } catch (error) {
        report('read', error);
        return Promise.resolve(null);
      }
    },

    setItem(key, value) {
      const current = getBackend();
      try {
        current?.set(key, value);
      } catch (error) {
        report('write', error);
      }
      return Promise.resolve();
    },

    removeItem(key) {
      const current = getBackend();
      try {
        current?.remove(key);
      } catch (error) {
        report('remove', error);
      }
      return Promise.resolve();
    },
  };
}
