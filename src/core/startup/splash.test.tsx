/// <reference types="jest" />
// RF-8, RF-10 (T4a). The native splash stays up until the persisted preferences are restored, with
// a cap: a slow or failing disk must never keep the app behind the splash.
//
// Compose: `SplashScreen.setKeepOnScreenCondition { !ready }`. SwiftUI: a launch screen that stays
// until the first `@AppStorage` read; here the cap is explicit.
import { act, renderHook } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { holdSplash, SPLASH_CAP_MS, useReleaseSplash } from './splash';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

const hide = jest.mocked(SplashScreen.hideAsync);

beforeEach(() => {
  jest.useFakeTimers();
  hide.mockClear();
});

describe('holdSplash', () => {
  it('asks the native splash to stay and absorbs a rejection (it was already hidden)', async () => {
    jest.mocked(SplashScreen.preventAutoHideAsync).mockRejectedValueOnce(new Error('already hidden'));
    await expect(holdSplash()).resolves.toBeUndefined();
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalled();
  });
});

describe('useReleaseSplash', () => {
  it('hides the splash as soon as the preferences are ready', async () => {
    await renderHook<void, { ready: boolean }>(({ ready }) => useReleaseSplash(ready), { initialProps: { ready: true } });
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('keeps it while not ready and hides it once ready, only once', async () => {
    const { rerender } = await renderHook<void, { ready: boolean }>(({ ready }) => useReleaseSplash(ready), { initialProps: { ready: false } });
    expect(hide).not.toHaveBeenCalled();

    await rerender({ ready: true });
    expect(hide).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(SPLASH_CAP_MS * 2);
    });
    await rerender({ ready: true });
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('never waits longer than the cap, even if the preferences never arrive', async () => {
    await renderHook(() => useReleaseSplash(false));
    await act(async () => {
      jest.advanceTimersByTime(SPLASH_CAP_MS - 1);
    });
    expect(hide).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('the cap is about one second', () => {
    expect(SPLASH_CAP_MS).toBe(1000);
  });

  it('a failing hide never throws into the UI', async () => {
    hide.mockRejectedValueOnce(new Error('no native module'));
    await renderHook(() => useReleaseSplash(true));
    await act(async () => {});
    expect(hide).toHaveBeenCalledTimes(1);
  });
});
