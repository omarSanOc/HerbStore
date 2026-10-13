/**
 * The part of `expo-network`'s `NetworkState` this app cares about. It is declared here (instead of
 * importing the type) so this file stays pure, testable under Node, and so `reconnection.ts` is
 * the only module that knows `expo-network` exists. Every field is optional/nullable because the
 * native module may not know a value (Android before a network is validated, web, etc.).
 */
export type ConnectivitySnapshot = {
  isConnected?: boolean | null | undefined;
  isInternetReachable?: boolean | null | undefined;
};

/**
 * Connected and the internet is not known to be unreachable. A missing/`null` `isInternetReachable`
 * means "unknown", which counts as reachable; a missing `isConnected` is not enough to be online.
 */
export function isOnline(snapshot: ConnectivitySnapshot): boolean {
  return snapshot.isConnected === true && snapshot.isInternetReachable !== false;
}

/** Explicitly offline: the platform said so. An unknown state is neither online nor offline. */
function isKnownOffline(snapshot: ConnectivitySnapshot): boolean {
  return snapshot.isConnected === false || snapshot.isInternetReachable === false;
}

/**
 * The device went from known offline to online. Without a previous state (the first event) it is
 * never a reconnection, and an unknown previous state is not "offline" either, so a cold start
 * cannot fake one.
 */
export function isReconnection(
  previous: ConnectivitySnapshot | undefined,
  next: ConnectivitySnapshot,
): boolean {
  return previous !== undefined && isKnownOffline(previous) && isOnline(next);
}
