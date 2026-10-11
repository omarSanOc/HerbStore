export type CartCountSource = {
  /** Registers a listener and returns its unsubscribe function. */
  subscribe: (listener: () => void) => () => void;
  /** Immutable snapshot: a primitive number, so `useSyncExternalStore` can compare with `Object.is`. */
  getSnapshot: () => number;
  /** Adds (or removes, if negative) units; the count never drops below zero. */
  add: (units: number) => void;
  reset: () => void;
};

/**
 * Minimal external store for the cart unit count. Day 4 replaces its implementation
 * with the real Redux cart selector without touching the tabs that consume it.
 * It must not import React Native so that `node --test` can run it.
 */
export function createCartCountSource(initialCount = 0): CartCountSource {
  let count = Math.max(0, Math.trunc(initialCount));
  const listeners = new Set<() => void>();

  function update(next: number) {
    const safeNext = Math.max(0, Math.trunc(next));

    if (safeNext === count) {
      return;
    }

    count = safeNext;
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => count,
    add: (units) => update(count + units),
    reset: () => update(0),
  };
}

export const cartCountSource = createCartCountSource();
