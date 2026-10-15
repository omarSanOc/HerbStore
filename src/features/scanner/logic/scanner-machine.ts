import type { ApiError } from '../../../core/api/api-error.ts';
import type { ProductDetail } from '../../product/contracts/catalog-product.ts';
import { isValidEan13 } from './ean13.ts';

export type ScannerState =
  | { kind: 'preview'; epoch: number }
  | { kind: 'checking-permission'; epoch: number }
  | { kind: 'mounting-camera'; epoch: number }
  | { kind: 'unavailable'; reason: string; epoch: number }
  | { kind: 'ready'; epoch: number }
  | { kind: 'invalid-code'; code: string; epoch: number }
  | { kind: 'querying'; code: string; epoch: number }
  | { kind: 'offline'; code: string; epoch: number }
  | { kind: 'timeout'; code: string; epoch: number }
  | { kind: 'temporary-error'; code: string; epoch: number }
  | { kind: 'invalid-data'; code: string; epoch: number }
  | { kind: 'not-found'; code: string; epoch: number }
  | { kind: 'navigating'; code: string; epoch: number; product: ProductDetail }
  | { kind: 'navigation-error'; code: string; epoch: number; product: ProductDetail }
  | { kind: 'closed'; epoch: number };

export type ScannerEvent =
  | { type: 'confirm' }
  | { type: 'permissionGranted' }
  | { type: 'permissionUnavailable'; reason: string }
  | { type: 'cameraReady' }
  | { type: 'cameraUnavailable'; reason: string }
  | { type: 'codeRead'; code: string }
  | { type: 'queryFinished'; epoch: number; product?: ProductDetail; error?: ApiError }
  | { type: 'navigationSucceeded' }
  | { type: 'navigationFailed' }
  | { type: 'retryNavigation' }
  | { type: 'retry' }
  | { type: 'rearm' }
  | { type: 'cancel' };

export const initialScannerState: ScannerState = { kind: 'preview', epoch: 0 };

function queryAgain(state: Extract<ScannerState, { code: string; epoch: number }>): ScannerState {
  return { kind: 'querying', code: state.code, epoch: state.epoch + 1 };
}

function errorState(state: Extract<ScannerState, { kind: 'querying' }>, error: ApiError): ScannerState {
  if (error.kind === 'http' && error.status === 404) return { ...state, kind: 'not-found' };
  if (error.kind === 'network') return { ...state, kind: 'offline' };
  if (error.kind === 'timeout') return { ...state, kind: 'timeout' };
  if (error.kind === 'http' && error.status >= 500) return { ...state, kind: 'temporary-error' };
  return { ...state, kind: 'invalid-data' };
}

export function scannerReducer(state: ScannerState, event: ScannerEvent): ScannerState {
  switch (event.type) {
    case 'confirm': return state.kind === 'preview' ? { kind: 'checking-permission', epoch: state.epoch } : state;
    case 'permissionGranted':
      return state.kind === 'checking-permission' || state.kind === 'unavailable'
        ? { kind: 'mounting-camera', epoch: state.epoch }
        : state;
    case 'permissionUnavailable':
      return state.kind === 'checking-permission'
        ? { kind: 'unavailable', reason: event.reason, epoch: state.epoch }
        : state.kind !== 'preview' && state.kind !== 'closed' && state.kind !== 'unavailable'
          ? { kind: 'unavailable', reason: event.reason, epoch: state.epoch + 1 }
          : state;
    case 'cameraReady':
      return state.kind === 'mounting-camera' ? { kind: 'ready', epoch: state.epoch } : state;
    case 'cameraUnavailable':
      return state.kind === 'mounting-camera' || state.kind === 'ready' || state.kind === 'querying'
        ? { kind: 'unavailable', reason: event.reason, epoch: state.epoch + 1 }
        : state;
    case 'codeRead':
      if (state.kind !== 'ready') return state;
      return isValidEan13(event.code)
        ? { kind: 'querying', code: event.code, epoch: state.epoch + 1 }
        : { kind: 'invalid-code', code: event.code, epoch: state.epoch };
    case 'queryFinished':
      if (state.kind !== 'querying' || state.epoch !== event.epoch) return state;
      if (event.product !== undefined) return { ...state, kind: 'navigating', product: event.product };
      return errorState(state, event.error ?? { kind: 'invalid' });
    case 'navigationSucceeded':
      return state.kind === 'navigating' ? { kind: 'ready', epoch: state.epoch } : state;
    case 'navigationFailed':
      return state.kind === 'navigating' ? { ...state, kind: 'navigation-error' } : state;
    case 'retryNavigation':
      return state.kind === 'navigation-error' ? { ...state, kind: 'navigating', epoch: state.epoch + 1 } : state;
    case 'retry':
      if (state.kind === 'offline' || state.kind === 'timeout' || state.kind === 'temporary-error' || state.kind === 'invalid-data') return queryAgain(state);
      return state;
    case 'rearm':
      return state.kind === 'invalid-code' || state.kind === 'not-found' ? { kind: 'ready', epoch: state.epoch + 1 } : state;
    case 'cancel':
      return state.kind === 'closed' ? state : { kind: 'closed', epoch: 'epoch' in state ? state.epoch + 1 : 1 };
  }
}
