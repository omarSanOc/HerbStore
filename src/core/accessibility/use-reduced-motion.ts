import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, type EmitterSubscription } from 'react-native';

let reducedMotionEnabled = false;
let nativeSubscription: EmitterSubscription | undefined;
const listeners = new Set<() => void>();

function updateReducedMotion(enabled: boolean) {
  if (reducedMotionEnabled === enabled) {
    return;
  }

  reducedMotionEnabled = enabled;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!nativeSubscription) {
    nativeSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updateReducedMotion,
    );
    void AccessibilityInfo.isReduceMotionEnabled().then(updateReducedMotion);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      nativeSubscription?.remove();
      nativeSubscription = undefined;
    }
  };
}

function getSnapshot() {
  return reducedMotionEnabled;
}

function getServerSnapshot() {
  return false;
}

export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
