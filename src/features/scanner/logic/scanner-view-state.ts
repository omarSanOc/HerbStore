import type { ScannerState } from './scanner-machine.ts';

export type ScannerViewState = {
  blocking: boolean;
  actions: { retry: boolean; cancel: boolean; rearm: boolean };
};

/**
 * The title key of each failed-lookup kind, written out. It used to be composed from the state kind
 * (`scanner.${kind}`), which produced `scanner.temporary-error` for a 503: the resource is
 * `temporaryError` and the screen showed the raw key (spec 006 T4b, RF-7). A literal map is checked
 * by the i18n audit and by a test that resolves every key in es and en.
 */
const FAILURE_TITLE_KEYS = {
  offline: 'scanner.offline',
  timeout: 'scanner.timeout',
  'temporary-error': 'scanner.temporaryError',
  'invalid-data': 'scanner.invalidData',
} as const;

export type ScannerFailureKind = keyof typeof FAILURE_TITLE_KEYS;

export function isScannerFailureKind(kind: string): kind is ScannerFailureKind {
  return kind in FAILURE_TITLE_KEYS;
}

export function scannerFailureTitleKey(kind: ScannerFailureKind): (typeof FAILURE_TITLE_KEYS)[ScannerFailureKind] {
  return FAILURE_TITLE_KEYS[kind];
}

export function shouldMountScannerCamera(state: ScannerState, focused: boolean): boolean {
  return focused && (state.kind === 'mounting-camera' || state.kind === 'ready' || state.kind === 'querying');
}

/**
 * Pure presentation policy. A failed lookup always offers an explicit retry (it is a plain GET, and
 * a server that is down while the system is connected sends no reconnection event). Connectivity
 * is deliberately NOT an input: it only changes the wording of the offline title (the screen). The
 * scanner itself never retries on its own.
 */
export function getScannerViewState(state: ScannerState): ScannerViewState {
  const blocking = !['preview', 'checking-permission', 'mounting-camera', 'ready'].includes(state.kind);
  return {
    blocking,
    actions: {
      retry: state.kind in FAILURE_TITLE_KEYS,
      cancel: state.kind !== 'closed' && blocking,
      rearm: state.kind === 'invalid-code' || state.kind === 'not-found',
    },
  };
}
