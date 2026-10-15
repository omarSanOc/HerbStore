import type { ScannerState } from './scanner-machine.ts';

export type ScannerViewState = {
  blocking: boolean;
  announcement: string;
  actions: { retry: boolean; cancel: boolean; rearm: boolean };
};

export function shouldMountScannerCamera(state: ScannerState, focused: boolean): boolean {
  return focused && (state.kind === 'mounting-camera' || state.kind === 'ready' || state.kind === 'querying');
}

/** Pure presentation policy: connectivity only enables an explicit retry; it never retries. */
export function getScannerViewState(state: ScannerState, isOnline: boolean): ScannerViewState {
  const blocking = !['preview', 'checking-permission', 'mounting-camera', 'ready'].includes(state.kind);
  return {
    blocking,
    announcement: `scanner.${state.kind}`,
    actions: {
      retry: isOnline && ['offline', 'timeout', 'temporary-error', 'invalid-data'].includes(state.kind),
      cancel: state.kind !== 'closed' && blocking,
      rearm: state.kind === 'invalid-code' || state.kind === 'not-found',
    },
  };
}
