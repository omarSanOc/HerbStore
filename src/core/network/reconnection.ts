import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';

import { isReconnection, type ConnectivitySnapshot } from './connectivity';

/*
 * The ONLY file of the app that imports `expo-network`. Each native listener is a
 * `ConnectivityManager.NetworkCallback` on Android and a `pathUpdateHandler` of an `NWPathMonitor`
 * on iOS: registering one per screen would multiply native callbacks and JS events for the same
 * fact, so every screen shares one lazily-created subscription.
 */

type Entry = { readonly callback: () => void };

const entries = new Set<Entry>();
let subscription: ReturnType<typeof addNetworkStateListener> | undefined;
let previous: ConnectivitySnapshot | undefined;
// Bumped on every start/stop so a late `getNetworkStateAsync` of an old session is ignored.
let session = 0;

function toSnapshot(state: ConnectivitySnapshot): ConnectivitySnapshot {
  return { isConnected: state.isConnected, isInternetReachable: state.isInternetReachable };
}

function handleChange(next: ConnectivitySnapshot) {
  const before = previous;
  previous = toSnapshot(next);

  if (isReconnection(before, next)) {
    if (__DEV__) {
      // Lets a device run tell "the network came back" apart from "nothing fired" (no user data).
      console.log(`[net] offline -> online (${entries.size} listener${entries.size === 1 ? '' : 's'})`);
    }
    // Copy first: a callback may unsubscribe itself while we iterate.
    for (const entry of [...entries]) {
      entry.callback();
    }
  }
}

function start() {
  const current = ++session;
  subscription = addNetworkStateListener(handleChange);

  // Seed the "previous" state, otherwise the first offline -> online change after launch would look
  // like a first event. An event that already arrived wins: it is newer than this read.
  getNetworkStateAsync().then(
    (state) => {
      if (current === session && previous === undefined) {
        previous = toSnapshot(state);
      }
    },
    () => {
      // Unknown state: the first event will seed it. Nothing user-related is worth logging.
    },
  );
}

function stop() {
  session++;
  subscription?.remove();
  subscription = undefined;
  previous = undefined;
}

/**
 * Calls `callback` every time the device goes from offline to online. The native subscription is
 * created with the first listener and removed (`remove()`) when the last one leaves, so an app
 * with no screen interested in reconnections keeps no native callback alive.
 *
 * Returns the function that cancels this listener (the `useEffect` cleanup). Compose:
 * `callbackFlow { registerNetworkCallback ... awaitClose { unregister } }` shared with
 * `shareIn(WhileSubscribed)`; SwiftUI/Combine: a shared `NWPathMonitor` publisher with
 * `.share()` that cancels the monitor with the last subscriber.
 */
export function onReconnect(callback: () => void): () => void {
  const entry: Entry = { callback };
  entries.add(entry);

  if (entries.size === 1) {
    start();
  }

  return () => {
    if (entries.delete(entry) && entries.size === 0) {
      stop();
    }
  };
}
