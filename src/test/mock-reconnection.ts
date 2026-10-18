/// <reference types="jest" />
// A controllable stand-in for `core/network/reconnection` (the only module that imports
// `expo-network`). A test installs it with
//   jest.mock('@/core/network/reconnection', () => jest.requireActual('@/test/mock-reconnection').reconnectionModule);
// and decides when "the device went from offline to online": `emitReconnect()`. Real
// `ConnectivityManager`/`NWPathMonitor` events are checked on devices; here the app's REACTION to
// that event is the thing under test.
//
// Compose: a fake `ConnectivityManager.NetworkCallback` you invoke by hand. SwiftUI: a fake
// `NWPathMonitor` publisher you `send()` on.

const listeners = new Set<() => void>();

export const reconnectionModule = {
  onReconnect: (callback: () => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};

/** The device is online again: every screen that listens is called, like the native listener would. */
export function emitReconnect() {
  for (const callback of [...listeners]) callback();
}

/** Call in `beforeEach`: no listener of a previous test survives. */
export function resetReconnectionMock() {
  listeners.clear();
}
